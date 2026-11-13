import { useEffect } from 'react';
import { observable, runInAction } from 'mobx';
import { SYMBOLS } from './config';
import { dispatch } from './dispatcher';
import { SpeedGate } from './gate';
import { edgeOf as edgeFor, entryDigit, winFn, type Suggestion, type TradeKind } from './signals';
import { nexus } from './store';
import { hub } from './ticks-hub';

export type AutoType = TradeKind;
export type Scan = {
    symbol: string;
    trigger: number; // entry digit: trade when the cursor lands on it
    rate: number; // % of times the trade won right after this digit, over the scanned 1,000 ticks
    samples: number;
    edge: number; // winning-digit share minus the theoretical baseline, in % points
    takenAt: number;
    ranking: { id: string; edge: number }[];
    expired: null | 'time' | 'drift';
};

export const auto = observable({
    type: 'DIGITOVER' as AutoType,
    barrier: 3,
    stake: 1,
    ai: true, // true: AI waits for the entry digit and trades; false: user trades manually on the signal
    mg: { on: false, mult: 2, max: 5 }, // martingale on loss
    ttl: 120, // scan validity (seconds)
    rescan: false, // re-scan automatically when a scan/strategy expires
    scan: null as Scan | null,
    now: Date.now(),
    signal: false,
    losses: 0,
    wins: 0,
    lost: 0,
    pnl: 0,
    last: '',
});

const DRIFT_POINTS = 1.5; // strategy expires when the scanned edge has fallen this many % points
export const needsBarrier = () => auto.type === 'DIGITOVER' || auto.type === 'DIGITUNDER';
const edgeOf = (dist: number[]) => edgeFor(dist, auto.type, auto.barrier);

export const resetScan = () =>
    runInAction(() => {
        auto.scan = null;
        auto.signal = false;
        nexus.autoOn = false;
    });

export const scanMarkets = (): boolean => {
    hub.watchAll();
    const rows = SYMBOLS.map(s => {
        const f = hub.feed(s.id);
        return f && f.digits.length >= 500 && !hub.isUnavailable(s.id) ? { id: s.id, edge: edgeOf(hub.distribution(s.id)), digits: f.digits } : null;
    }).filter(Boolean) as { id: string; edge: number; digits: number[] }[];
    if (!rows.length) {
        nexus.log('Market ticks are still loading — try the scan again in a few seconds.');
        return false;
    }
    rows.sort((a, b) => b.edge - a.edge);
    const best = rows[0];
    runInAction(() => {
        auto.scan = { symbol: best.id, ...entryDigit(best.digits, winFn(auto.type, auto.barrier)), edge: best.edge, takenAt: Date.now(), ranking: rows.slice(0, 5).map(r => ({ id: r.id, edge: r.edge })), expired: null };
        auto.signal = false;
        auto.now = Date.now();
    });
    return true;
};

const expire = (reason: 'time' | 'drift') => {
    if (!auto.scan || auto.scan.expired) return;
    runInAction(() => {
        auto.scan!.expired = reason;
        auto.signal = false;
    });
    if (auto.rescan && scanMarkets()) return; // keeps running on the fresh scan
    runInAction(() => (nexus.autoOn = false)); // otherwise stop and ask for a new scan
};

export const nextStake = () => {
    const step = auto.mg.on ? Math.min(auto.losses, auto.mg.max) : 0;
    return Math.round(auto.stake * auto.mg.mult ** step * 100) / 100;
};

const place = async (symbol: string) => {
    const r = await dispatch({ symbol, contract_type: auto.type, stake: nextStake(), barrier: needsBarrier() ? auto.barrier : undefined, source: 'auto' });
    runInAction(() => {
        if (r.error) {
            nexus.autoOn = false;
            auto.last = r.error;
            return;
        }
        auto.pnl += r.profit ?? 0;
        if (r.won) (auto.wins++, (auto.losses = 0));
        else (auto.lost++, (auto.losses = auto.mg.on && auto.losses >= auto.mg.max ? 0 : auto.losses + 1)); // cycle back after max steps
        auto.last = `${r.won ? 'Won' : 'Lost'} ${Math.abs(r.profit ?? 0).toFixed(2)}`;
    });
};

export const startAi = () => {
    if (!auto.scan || auto.scan.expired) return nexus.log('Scan the markets first — new scan needed.');
    nexus.autoOn = true;
};
export const runNow = () => {
    if (!auto.scan || auto.scan.expired) return nexus.log('Scan expired — new scan needed.');
    place(auto.scan.symbol);
};

const beep = () => {
    try {
        const ctx = new AudioContext(), o = ctx.createOscillator();
        o.connect(ctx.destination);
        o.frequency.value = 880;
        o.start();
        o.stop(ctx.currentTime + 0.15);
    } catch {
        /* audio not available */
    }
};

/** Mounted once at app level: watches the scanned market tick-by-tick, signals/enters on the entry digit, expires stale scans. */
export const useAutoEngine = () =>
    useEffect(() => {
        const gate = new SpeedGate();
        const off = hub.onTick((sym, seq) => {
            const sc = auto.scan;
            if (!sc || sc.expired || sym !== sc.symbol) return;
            const signal = hub.feed(sym)?.digits.at(-1) === sc.trigger;
            if (signal && !auto.signal && !auto.ai) beep();
            if (signal !== auto.signal) runInAction(() => (auto.signal = signal));
            if (seq % 10 === 0 && sc.edge - edgeOf(hub.distribution(sym)) >= DRIFT_POINTS) return expire('drift');
            if (nexus.autoOn && auto.ai && signal && gate.can(sym, seq)) gate.run(sym, seq, () => place(sym));
        });
        const clock = setInterval(() => {
            if (!auto.scan) return; // nothing to count down
            runInAction(() => (auto.now = Date.now()));
            const sc = auto.scan;
            if (sc && !sc.expired && Date.now() - sc.takenAt > auto.ttl * 1000) expire('time');
        }, 1000);
        return () => (off(), clearInterval(clock));
    }, []);

/** Used by the Signals page: fills the Auto Trader with a suggested strategy, ready to START AI / RUN NOW. */
export const loadSuggestion = (s: Suggestion) =>
    runInAction(() => {
        auto.type = s.type;
        auto.barrier = s.barrier;
        auto.scan = { symbol: s.symbol, trigger: s.trigger, rate: s.rate, samples: s.samples, edge: s.edge, takenAt: Date.now(), ranking: [{ id: s.symbol, edge: s.edge }], expired: null };
        auto.signal = false;
        auto.now = Date.now();
        nexus.autoOn = false;
    });
