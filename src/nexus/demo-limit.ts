// @ts-nocheck
import { observer as bus } from '@/external/bot-skeleton/utils/observer';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { DEMO_LIMIT_EXEMPT, DEMO_LIMIT_HOURS, DEMO_LIMIT_TRADES } from './config';

/**
 * Demo trade limit. Every purchase made on a demo account counts (bots, Manual, Bulk, Hedge, Auto: they all emit the same
 * `contract.purchase_received` event). At DEMO_LIMIT_TRADES the demo locks for DEMO_LIMIT_HOURS: the running bot is stopped,
 * the pop-up opens, and Run / new trades on the demo account open the pop-up again. The count lives in this browser only.
 */
const KEY = 'nx_demo_limit';
const HOUR = 3600000;
type State = { count: number; lockedAt: number };
const listeners = new Set<() => void>();
let started = false;
let pendingFinish = false;
let stopper: null | (() => void) = null;

const read = (): State => {
    try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { count: Number(s.count) || 0, lockedAt: Number(s.lockedAt) || 0 }; } catch (e) { return { count: 0, lockedAt: 0 }; }
};
const write = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };

export const demoLimitEnabled = () => DEMO_LIMIT_TRADES > 0;
/** Deriv demo logins start with VR, DEM or DOT (real ones with CR, MF, ROT...). The stored account list is checked first. */
const looksDemo = (id: string) => {
    try {
        const a = (DerivWSAccountsService.getStoredAccounts() || []).find((x: any) => (x.account_id || x.loginid) === id);
        if (a?.account_type) return a.account_type === 'demo';
    } catch (e) {}
    return /^(VR|DEM|DOT)/i.test(id) || localStorage.getItem('account_type') === 'demo';
};
export const isDemoSession = () => {
    try {
        const id = localStorage.getItem('active_loginid') || '';
        if (!id || DEMO_LIMIT_EXEMPT.includes(id.toUpperCase())) return false; // exempt (owner) accounts are never counted or locked
        return looksDemo(id);
    } catch (e) { return false; }
};
/** Milliseconds left on the lock, or 0 when the demo is open (a finished lock clears itself). */
export const lockRemaining = (): number => {
    const s = read();
    if (!s.lockedAt) return 0;
    const left = s.lockedAt + DEMO_LIMIT_HOURS * HOUR - Date.now();
    if (left <= 0) { write({ count: 0, lockedAt: 0 }); return 0; }
    return left;
};
export const demoBlocked = () => demoLimitEnabled() && isDemoSession() && lockRemaining() > 0;
export const demoTradesUsed = () => read().count;

export const subscribeDemoLimit = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
let open = false;
export const isDemoLimitOpen = () => open;
export const openDemoLimit = () => { open = true; listeners.forEach(f => f()); };
export const closeDemoLimit = () => { open = false; listeners.forEach(f => f()); };
export const setBotStopper = (fn: null | (() => void)) => { stopper = fn; };

/** Called when someone tries to start a trade. Returns true (and shows the pop-up) when the demo is locked. */
export const demoGuard = (): boolean => {
    if (!demoBlocked()) return false;
    openDemoLimit();
    return true;
};

const finish = () => {
    if (!pendingFinish) return;
    pendingFinish = false;
    try { stopper?.(); } catch (e) {}
    openDemoLimit();
};

export const startDemoLimit = () => {
    if (started) return;
    started = true;
    window.__nexusDemoGuard = demoGuard;
    bus.register('contract.status', (e: any) => {
        if (!demoLimitEnabled() || !isDemoSession()) return;
        if (e?.id === 'contract.purchase_received') {
            if (lockRemaining() > 0) return;
            const s = read();
            const count = s.count + 1;
            if (count >= DEMO_LIMIT_TRADES) {
                write({ count, lockedAt: Date.now() }); // locked at once so no further trade can be bought
                pendingFinish = true;
                setTimeout(finish, 6000); // the pop-up opens when this trade settles, or after 6 s
            } else write({ count, lockedAt: 0 });
            listeners.forEach(f => f());
        } else if (e?.id === 'contract.sold') finish();
    });
};

export const formatLeft = (ms: number) => {
    const m = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};
