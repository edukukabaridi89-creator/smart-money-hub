import { makeAutoObservable, runInAction } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import { buyParameters, type BuyRequest } from './buy-params';
import { isProduction } from '@/components/shared';
import brandConfig from '../../brand.config.json';
import { APP_ID } from './config';
import { SpeedMode, speedState } from './speed';

export type FollowerAccount = { account_id: string; account_type: 'demo' | 'real'; currency: string; balance: number; status?: string };
export type TokenItem = { token: string; status: 'connecting' | 'ready' | 'error'; error?: string; accounts: FollowerAccount[]; copied: number; failed: number; lastResult?: string };
const LS_TOKENS = 'nexus_tokens';
const B = () => (window as any).Blockly;

class NexusStore {
    /** The app's root MobX store (run_panel, transactions, dashboard, client...). Set once by <NexusMount />. */
    root: any = null;
    private open_trades = 0;
    symbol = 'R_100'; // single source of truth: DCircles <-> Bot Builder <-> Manual/Hedge/Bulk
    notice = '';
    tokens: TokenItem[] = [];
    copyRunning = false;
    copyPaused = false;
    executionSpeedMode: SpeedMode = speedState.mode;
    autoOn = false;

    constructor() {
        makeAutoObservable(this, { root: false });
        (window as any).__nexusMirror = (p: Record<string, unknown>) => this.mirrorParams(p); // used by the bot engine (Purchase.js)
        try {
            JSON.parse(localStorage.getItem(LS_TOKENS) || '[]').forEach((t: string) => this.addToken(t));
        } catch {
            /* ignore corrupted cache */
        }
    }

    setSpeed = (m: SpeedMode) => {
        this.executionSpeedMode = m;
        speedState.mode = m; // read live by the bot engine + every runner
        localStorage.setItem('nexus_speed', m);
    };
    goTab = (index: number) => this.root?.dashboard?.setActiveTab(index);
    getLoginid = (): string | undefined => this.root?.client?.loginid;

    /**
     * Makes a trade placed outside Bot Builder behave like a Bot Builder run: the run panel only listens for
     * contract events while a run is active, so (re)attach its listeners, open the panel, and give the
     * transactions a run id. Re-registering first avoids stacking duplicate listeners (Observer doesn't dedupe).
     */
    beginTrade = () => {
        const rp = this.root?.run_panel;
        if (!rp) return;
        this.open_trades++;
        rp.unregisterBotListeners();
        rp.registerBotListeners();
        runInAction(() => {
            if (!rp.run_id) rp.run_id = `run-${Date.now()}`;
            rp.toggleDrawer(true);
        });
    };
    endTrade = () => {
        const rp = this.root?.run_panel;
        this.open_trades = Math.max(0, this.open_trades - 1);
        if (rp && this.open_trades === 0 && !rp.is_running) rp.unregisterBotListeners(); // leave a clean slate for the next bot run
    };
    log = (m: string) => {
        this.notice = m;
        setTimeout(() => runInAction(() => this.notice === m && (this.notice = '')), 5000);
    };

    /** Two-way bound: pushes into Blockly's market block; Blockly -> store happens in bindBlockly(). */
    setSymbol = (s: string) => {
        if (s === this.symbol) return;
        this.symbol = s;
        try {
            const blk = B()?.derivWorkspace?.getBlocksByType('trade_definition_market')?.[0];
            const f = blk?.getField('SYMBOL_LIST');
            if (f && f.getValue() !== s) f.setValue(s);
        } catch (e) {
            console.warn('[nexus] could not set Blockly symbol', e);
        }
    };

    /** Blockly -> store (one-way pull), used after a bot is imported. */
    pullSymbol = () => {
        const v = B()?.derivWorkspace?.getBlocksByType('trade_definition_market')?.[0]?.getFieldValue('SYMBOL_LIST');
        if (v) runInAction(() => (this.symbol = v));
    };

    bindBlockly = async () => {
        for (let i = 0; i < 100 && !B()?.derivWorkspace; i++) await new Promise(r => setTimeout(r, 300));
        const ws = B()?.derivWorkspace;
        if (!ws) return;
        const read = () => ws.getBlocksByType('trade_definition_market')?.[0]?.getFieldValue('SYMBOL_LIST');
        const initial = read();
        if (initial) runInAction(() => (this.symbol = initial));
        ws.addChangeListener((e: any) => {
            if (e.type === B().Events.BLOCK_CHANGE && e.name === 'SYMBOL_LIST') {
                const v = read();
                if (v && v !== this.symbol) runInAction(() => (this.symbol = v));
            }
        });
    };

    // ---------- Copy trading ----------
    // Followers are Deriv API tokens (personal access tokens with the "trade" scope). Their accounts and live balances come from
    // GET .../options/accounts, and every trade placed here (pages AND bots) is copied with ONE call to Deriv's
    // bulk-purchase endpoint, to the followers' accounts of the same type as the logged-in account (demo -> demo, real -> real).
    private persist = () => localStorage.setItem(LS_TOKENS, JSON.stringify(this.tokens.map(t => t.token)));
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private api = () => `${brandConfig.platform.derivws.url[isProduction() ? 'production' : 'staging']}${brandConfig.platform.derivws.directories.options}`;
    private headers = (token: string): Record<string, string> => ({ Authorization: `Bearer ${token}`, 'Deriv-App-ID': APP_ID });
    /** 'demo' when the account logged in to this app is a demo account. */
    masterType = (): 'demo' | 'real' => (this.root?.client?.is_virtual ? 'demo' : 'real');

    refreshToken = async (token: string) => {
        const cur = () => this.tokens.find(x => x.token === token);
        try {
            const res = await fetch(`${this.api()}accounts`, { headers: this.headers(token) });
            const body: any = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.errors?.[0]?.message || body?.error?.message || body?.message || `Deriv answered ${res.status}`);
            const list: any[] = body?.data ?? [];
            runInAction(() => {
                const c = cur();
                if (!c) return;
                c.accounts = list.map(a => ({ account_id: String(a.account_id), account_type: a.account_type === 'demo' ? 'demo' : 'real', currency: a.currency, balance: Number(a.balance), status: a.status }));
                c.status = c.accounts.length ? 'ready' : 'error';
                c.error = c.accounts.length ? '' : 'This token has no options accounts.';
            });
        } catch (e: any) {
            runInAction(() => {
                const c = cur();
                if (c) { c.status = 'error'; c.error = String(e?.message || e); }
            });
        }
    };
    refreshAll = () => this.tokens.forEach(t => this.refreshToken(t.token));
    addToken = (token: string) => {
        token = token.trim();
        if (!token || this.tokens.some(t => t.token === token)) return;
        this.tokens.push({ token, status: 'connecting', accounts: [], copied: 0, failed: 0 });
        this.persist();
        this.refreshToken(token);
        if (!this.pollTimer) this.pollTimer = setInterval(this.refreshAll, 20000);
    };
    removeToken = (token: string) => {
        this.tokens = this.tokens.filter(t => t.token !== token);
        this.persist();
        if (!this.tokens.length && this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    };
    startCopy = () => ((this.copyRunning = true), (this.copyPaused = false));
    pauseAll = () => (this.copyPaused = true);
    resumeAll = () => (this.copyPaused = false);
    /** Follower accounts that would receive a copy right now. */
    get copyTargets() {
        const type = this.masterType();
        return this.tokens.filter(t => t.status === 'ready').flatMap(t => t.accounts.filter(a => a.account_type === type && a.status !== 'inactive').map(a => ({ token: t.token, ...a })));
    }
    /** Copy one contract (buy `parameters`, as sent to the API) to every follower account of the same type as the master. */
    mirrorParams = (parameters: Record<string, unknown>) => {
        if (!this.copyRunning || this.copyPaused) return;
        const type = this.masterType();
        const byCurrency = new Map<string, { token: string; account_id: string }[]>();
        this.copyTargets.forEach(a => byCurrency.set(a.currency, [...(byCurrency.get(a.currency) ?? []), { token: a.token, account_id: a.account_id }]));
        byCurrency.forEach((accounts, currency) => {
            for (let i = 0; i < accounts.length; i += 100) {
                const chunk = accounts.slice(i, i + 100);
                fetch(`${this.api()}contracts/bulk-purchase/${type}`, {
                    method: 'POST',
                    headers: { 'Deriv-App-ID': APP_ID, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contract_parameters: { ...parameters, currency }, accounts: chunk }),
                })
                    .then(async res => ({ res, body: await res.json().catch(() => ({})) as any }))
                    .then(({ res, body }) => runInAction(() => this.recordCopy(chunk, res.ok ? body?.data?.transactions : null, body?.errors?.[0]?.message || body?.error?.message || body?.message || `Deriv answered ${res.status}`)))
                    .catch(e => runInAction(() => this.recordCopy(chunk, null, String(e?.message || e))));
            }
        });
        setTimeout(this.refreshAll, 4000); // show the new balances
    };
    private recordCopy = (sent: { token: string; account_id: string }[], tx: any[] | null, error: string) => {
        sent.forEach((a, i) => {
            const c = this.tokens.find(t => t.token === a.token);
            if (!c) return;
            const r = Array.isArray(tx) ? tx.find(x => String(x?.account_id) === a.account_id) ?? tx[i] : null;
            const msg = r?.error?.message ?? r?.error ?? (r?.status === 'error' || r?.success === false ? r?.message || 'failed' : '');
            if (tx && !msg) { c.copied += 1; c.lastResult = `Copied to ${a.account_id}`; }
            else { c.failed += 1; c.lastResult = `Not copied to ${a.account_id}: ${typeof msg === 'string' && msg ? msg : error}`; }
        });
    };
    /** Called by the dispatcher: replicate the master's order on every follower account. */
    mirror = (r: BuyRequest & { currency: string }) => this.mirrorParams(buyParameters(r, r.currency));
}
export const nexus = new NexusStore();
