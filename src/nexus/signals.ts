import { symbolName } from './config';
import { hub } from './ticks-hub';

export type TradeKind = 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER';
export type Candidate = { type: TradeKind; barrier: number };
export type Suggestion = Candidate & { symbol: string; label: string; edge: number; z: number; trigger: number; rate: number; samples: number };

export const winFn = (type: TradeKind, barrier: number) => (d: number) =>
    type === 'DIGITOVER' ? d > barrier : type === 'DIGITUNDER' ? d < barrier : type === 'DIGITEVEN' ? d % 2 === 0 : d % 2 === 1;
export const baselineOf = (type: TradeKind, barrier: number) => (type === 'DIGITOVER' ? (9 - barrier) * 10 : type === 'DIGITUNDER' ? barrier * 10 : 50);
/** Share of winning digits in the last 1,000 ticks minus the theoretical probability, in % points. */
export const edgeOf = (dist: number[], type: TradeKind, barrier: number) => {
    const win = winFn(type, barrier);
    return dist.reduce((s, p, d) => s + (win(d) ? p : 0), 0) - baselineOf(type, barrier);
};
export const labelOf = (type: TradeKind, barrier: number) => (type === 'DIGITEVEN' ? 'Even' : type === 'DIGITODD' ? 'Odd' : `${type === 'DIGITOVER' ? 'Over' : 'Under'} ${barrier}`);

/** For every digit d: how often the trade won on the tick right after the cursor landed on d. Best d = entry digit. */
export const entryDigit = (digits: number[], win: (d: number) => boolean) => {
    const total = Array(10).fill(0), won = Array(10).fill(0);
    for (let i = 0; i < digits.length - 1; i++) {
        total[digits[i]]++;
        if (win(digits[i + 1])) won[digits[i]]++;
    }
    let best = { trigger: 0, rate: -1, samples: 0 };
    total.forEach((t, d) => {
        const rate = t >= 20 ? (won[d] / t) * 100 : -1;
        if (rate > best.rate) best = { trigger: d, rate, samples: t };
    });
    return best;
};

export const CANDIDATES: Candidate[] = [
    { type: 'DIGITEVEN', barrier: 0 },
    { type: 'DIGITODD', barrier: 0 },
    ...Array.from({ length: 9 }, (_, b) => ({ type: 'DIGITOVER' as const, barrier: b })), // Over 0-8
    ...Array.from({ length: 9 }, (_, i) => ({ type: 'DIGITUNDER' as const, barrier: i + 1 })), // Under 1-9
];

const cache = new Map<string, { rev: number; value: Suggestion | null }>();
/** Best trade type for a market right now: the candidate whose winning-digit share is the most unusual (z-score). */
export const suggest = (symbol: string): Suggestion | null => {
    const f = hub.feed(symbol);
    if (!f || f.digits.length < 500 || hub.isUnavailable(symbol)) return null;
    const hit = cache.get(symbol);
    if (hit && f.rev - hit.rev < 5) return hit.value; // recomputed every 5 updates, not on every render
    const value = compute(symbol, f);
    cache.set(symbol, { rev: f.rev, value });
    return value;
};

const compute = (symbol: string, f: NonNullable<ReturnType<typeof hub.feed>>): Suggestion | null => {
    const dist = hub.distribution(symbol), n = f.digits.length;
    let best: (Candidate & { edge: number; z: number }) | null = null;
    for (const c of CANDIDATES) {
        const edge = edgeOf(dist, c.type, c.barrier);
        const p = baselineOf(c.type, c.barrier) / 100;
        const z = edge / 100 / Math.sqrt((p * (1 - p)) / n);
        if (!best || z > best.z) best = { ...c, edge, z };
    }
    return { ...best!, symbol, label: labelOf(best!.type, best!.barrier), ...entryDigit(f.digits, winFn(best!.type, best!.barrier)) };
};
export { symbolName };
