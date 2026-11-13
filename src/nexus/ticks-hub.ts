import { getPublicWsUrl } from '@/external/deriv-core/config/urls';
import { LEGACY_WS_URL, SYMBOLS } from './config';

type Listener = () => void;
type TickFn = (symbol: string, seq: number) => void;
type Feed = { digits: number[]; prices: number[]; pip: number; last: number | null; seq: number; rev: number };

/** Pip size can arrive as decimal places (2) or as a step (0.01); fall back to the longest decimal seen. */
const pipOf = (raw: unknown, prices: number[]) => {
    let p = typeof raw === 'number' ? raw : NaN;
    if (p > 0 && p < 1) p = Math.round(-Math.log10(p));
    if (!Number.isInteger(p) || p < 0 || p > 8) p = Math.max(0, ...prices.slice(-200).map(x => (String(x).split('.')[1] || '').length));
    return p;
};
const digitOf = (price: number, pip: number) => Number(price.toFixed(pip).slice(-1));

/**
 * One public WebSocket streaming the last 1,000 ticks (+ live ticks) for every volatility index.
 * Primary endpoint: the app's own public Deriv WebSocket. Fallback: the legacy app_id endpoint.
 */
class TicksHub {
    status = 'Connecting…';
    private ws: WebSocket | null = null;
    private idx = 0;
    private feeds: Record<string, Feed> = {};
    private unavailable = new Set<string>();
    // listeners can name the markets they care about, so a tick on one market doesn't re-render components showing another
    private listeners = new Map<Listener, Set<string> | null>();
    private dist: Record<string, { rev: number; d: number[] }> = {};
    private tickListeners = new Set<TickFn>();
    private wanted = new Set<string>();
    private watchdog: ReturnType<typeof setTimeout> | undefined;
    private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
    private reqId = 1000;

    private endpoints = () => [getPublicWsUrl(), LEGACY_WS_URL];
    private emit = (sym?: string) => this.listeners.forEach((syms, l) => (!sym || !syms || syms.has(sym)) && l());
    private loaded = () => Object.keys(this.feeds).length > 0;

    private connect() {
        if (this.ws) return;
        const url = this.endpoints()[this.idx % 2];
        this.status = 'Connecting…';
        const ws = new WebSocket(url);
        this.ws = ws;
        ws.onopen = () => {
            this.wanted.forEach(s => this.request(s));
            clearTimeout(this.watchdog);
            this.watchdog = setTimeout(() => !this.loaded() && this.rotate('No data received'), 8000);
        };
        ws.onmessage = ev => this.onMessage(JSON.parse(ev.data));
        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.ws = null;
            this.status = 'Reconnecting…';
            this.emit();
            setTimeout(() => this.wanted.size && this.connect(), 1500);
        };
    }

    /** Switch to the other endpoint (used when one rejects us or sends nothing). */
    private rotate(reason: string) {
        this.status = `${reason} — trying another server…`;
        this.idx++;
        this.ws?.close();
        this.emit();
    }

    private request(symbol: string) {
        this.ws?.send(JSON.stringify({ ticks_history: symbol, end: 'latest', count: 1000, style: 'ticks', subscribe: 1 }));
    }

    private onMessage(m: any) {
        let touched: string | undefined;
        const waiting = m.req_id !== undefined ? this.pending.get(m.req_id) : undefined;
        if (waiting) {
            this.pending.delete(m.req_id);
            return m.error ? waiting.reject(m) : waiting.resolve(m);
        }
        if (m.error) {
            const sym = m.echo_req?.ticks_history;
            if (sym && /Symbol|Market|NotOffered/i.test(m.error.code ?? '')) this.unavailable.add(sym);
            else if (!this.loaded()) this.rotate(m.error.message ?? 'Server error');
            return this.emit();
        }
        if (m.history) {
            const sym = m.echo_req?.ticks_history;
            const prices: number[] = (m.history.prices ?? []).map(Number);
            if (!sym || !prices.length) return;
            const pip = pipOf(m.pip_size, prices);
            this.feeds[sym] = { pip, prices, digits: prices.map(p => digitOf(p, pip)), last: prices.at(-1) ?? null, seq: 0, rev: (this.feeds[sym]?.rev ?? 0) + 1 };
            this.status = 'Live';
            touched = sym;
        } else if (m.tick) {
            const sym = m.tick.symbol ?? m.tick.underlying_symbol ?? m.echo_req?.ticks_history;
            const f = this.feeds[sym];
            if (!f) return;
            const q = Number(m.tick.quote);
            if (m.tick.pip_size !== undefined) f.pip = pipOf(m.tick.pip_size, f.prices);
            f.prices.push(q);
            f.digits.push(digitOf(q, f.pip));
            if (f.prices.length > 1000) (f.prices.shift(), f.digits.shift());
            f.last = q;
            f.seq++;
            f.rev++;
            touched = sym;
            this.tickListeners.forEach(l => l(sym, f.seq));
        } else return;
        this.emit(touched);
    }

    /** One request, one answer, over the public socket (e.g. proposal / contracts_for before the user logs in). */
    call(payload: Record<string, unknown>): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connect();
            const id = ++this.reqId;
            const t0 = Date.now();
            const go = () => {
                if (this.ws?.readyState === 1) {
                    this.pending.set(id, { resolve, reject });
                    this.ws.send(JSON.stringify({ ...payload, req_id: id }));
                    setTimeout(() => this.pending.delete(id) && reject({ error: { message: 'The request timed out.' } }), 15000);
                } else if (Date.now() - t0 > 10000) reject({ error: { message: 'Could not reach the market server.' } });
                else setTimeout(go, 200);
            };
            go();
        });
    }

    watch(symbols: string[]) {
        symbols.forEach(s => {
            if (this.wanted.has(s)) return;
            this.wanted.add(s);
            this.connect();
            if (this.ws?.readyState === 1) this.request(s);
        });
    }
    watchAll = () => this.watch(SYMBOLS.map(s => s.id));
    onChange(fn: Listener, symbols?: string[]) {
        this.listeners.set(fn, symbols ? new Set(symbols) : null);
        return () => this.listeners.delete(fn);
    }
    /** Fires once per live tick with the symbol and its running tick number. */
    onTick(fn: TickFn) {
        this.tickListeners.add(fn);
        return () => this.tickListeners.delete(fn);
    }
    feed = (symbol: string): Feed | undefined => this.feeds[symbol];
    isUnavailable = (symbol: string) => this.unavailable.has(symbol);
    /** Percentage (0-100) of each digit 0-9 over the last 1,000 ticks. */
    distribution(symbol: string): number[] {
        const f = this.feeds[symbol];
        const hit = this.dist[symbol];
        if (f && hit && hit.rev === f.rev) return hit.d; // unchanged since last time
        const d = f?.digits ?? [];
        const c = Array(10).fill(0);
        d.forEach(x => c[x]++);
        const out = c.map(n => (d.length ? (n / d.length) * 100 : 0));
        if (f) this.dist[symbol] = { rev: f.rev, d: out };
        return out;
    }
}
export const hub = new TicksHub();
