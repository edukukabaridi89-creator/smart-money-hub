import type { BotSpec } from './studio/bot-spec';
import { MIN_STAKE } from './studio/bot-spec';
import type { Suggestion } from './signals';

/** Stake = 10% of capital, doubled after every loss (martingale x2). */
export const STAKE_PCT = 0.1;
export const MULTIPLIER = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

export type Step = { n: number; stake: number; lost: number; affordable: boolean };
export type Plan = {
    capital: number;
    stake: number;
    valid: boolean; // capital > 0 and the stake reaches the minimum Deriv allows
    minCapital: number;
    steps: Step[]; // the next losing trades, doubled each time
    survivable: number; // losing trades in a row the capital can pay for
    maxStake: number; // largest stake the plan allows, after that it goes back to the first stake
    takeProfit: number;
    stopLoss: number;
};

export const planFor = (capital: number): Plan => {
    const cap = Number.isFinite(capital) && capital > 0 ? capital : 0;
    const stake = r2(cap * STAKE_PCT);
    const valid = cap > 0 && stake >= MIN_STAKE;
    const steps: Step[] = [];
    let lost = 0;
    for (let n = 1; n <= 6 && valid; n++) {
        const s = r2(stake * MULTIPLIER ** (n - 1));
        lost = r2(lost + s);
        steps.push({ n, stake: s, lost, affordable: lost <= cap });
    }
    const afford = steps.filter(s => s.affordable);
    const survivable = afford.length;
    const last = afford[survivable - 1];
    return {
        capital: cap,
        stake,
        valid,
        minCapital: r2(MIN_STAKE / STAKE_PCT),
        steps,
        survivable,
        maxStake: last ? last.stake : stake,
        takeProfit: r2(stake * 2),
        stopLoss: last ? last.lost : stake,
    };
};

/** Bot Builder spec for the best market found: entry on the best digit, stake x2 after each loss, capped by the capital. */
export const specFor = (plan: Plan, s: Suggestion): BotSpec => {
    const overUnder = s.type === 'DIGITOVER' || s.type === 'DIGITUNDER';
    return {
        name: `Risk plan: ${s.label} on ${s.symbol}`,
        symbol: s.symbol,
        side: s.type,
        ...(overUnder ? { barrier: s.barrier } : {}),
        stake: plan.stake,
        duration: 1,
        progression: 'martingale',
        multiplier: MULTIPLIER,
        maxStake: plan.maxStake,
        takeProfit: plan.takeProfit,
        stopLoss: plan.stopLoss,
        entry: { mode: 'digit', op: 'EQ', digit: s.trigger },
    };
};
