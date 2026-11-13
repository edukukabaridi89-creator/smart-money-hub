import { extract, parseAnswer, type Slot } from './nlu';
import {
    ADV_KEYS, advancedOn, barrierRange, canPickBest, describe, oppositeOf, supportsCap, durationRange, isComplete, marketLabel, MARKETS, MIN_STAKE, needsBarrier, NO_LIMIT, PROGRESSIONS, progressionOf, SIDE_LABEL, summaryRows,
    type Draft, type Side,
} from './bot-spec';

export type Chip = { label: string; patch?: Draft; clear?: (keyof Draft)[]; text?: string; action?: 'create' | 'change' | 'restart' };
export type Turn = { draft: Draft; say: string[]; chips: Chip[]; expecting: Slot | null; complete: boolean; create?: boolean };
export type Input = { text?: string; patch?: Draft; clear?: (keyof Draft)[]; action?: Chip['action'] };

const RESTART = /\b(?:start over|start again|reset|clear everything|new bot|from scratch)\b/i;
const YES = /^\s*(?:yes|yep|yeah|create|create it|create bot|build|build it|go ahead|do it|make it|ok|okay|looks good|confirm)\b/i;
const round2 = (n: number) => Math.round(n * 100) / 100;

export const nextSlot = (d: Draft): Slot | null => {
    if (!d.symbol) return 'symbol';
    if (!d.side) return 'side';
    if (needsBarrier(d.side) && d.barrier === undefined) return 'barrier';
    if (d.stake === undefined) return 'stake';
    if (d.duration === undefined) return 'duration';
    if (!d.progression) return 'progression';
    const param = progressionOf(d.progression)!.param;
    if (param === 'multiplier' && d.multiplier === undefined) return 'multiplier';
    if (param === 'unit' && d.unit === undefined) return 'unit';
    if (supportsCap(d.progression) && d.maxStake === undefined) return 'maxStake';
    if (d.takeProfit === undefined) return 'takeProfit';
    if (d.stopLoss === undefined) return 'stopLoss';
    if (!d.entry) return 'entry';
    if (d.entry.mode === 'digit' && (d.entry.op === undefined || d.entry.digit === undefined)) return 'entryDigit';
    if (!d.advanced && !advancedOn(d)) return 'advanced';
    if (d.recover === 'ask' || (d.recover === 'best' && !d.recoverFamily)) return 'recoverKind';
    if (d.recover === 'fixed' && !d.recoverSide) return 'recoverSide';
    if (d.recover === 'fixed' && needsBarrier(d.recoverSide) && d.recoverBarrier === undefined) return 'recoverBarrier';
    if (d.recover === 'best' && d.recoverFamily === 'overunder' && d.recoverBarrier === undefined) return 'recoverBarrier';
    if (d.switchAsk || d.switchAfter !== undefined) {
        if (d.switchAfter === undefined) return 'switchAfter';
        if (!d.switchMarkets?.length) return 'switchMarkets';
    }
    return null;
};

const numChips = (values: number[], key: 'stake' | 'multiplier' | 'unit' | 'duration' | 'barrier' | 'takeProfit' | 'stopLoss' | 'maxStake' | 'recoverBarrier' | 'switchAfter'): Chip[] =>
    values.map(v => ({ label: String(v), patch: { [key]: v } as Draft }));

const question = (slot: Slot, d: Draft): { text: string; chips: Chip[] } => {
    switch (slot) {
        case 'symbol':
            return { text: 'Which market should it trade?', chips: MARKETS.map(m => ({ label: m.name, patch: { symbol: m.id } })) };
        case 'side':
            return {
                text: 'What should it trade?',
                chips: (['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF', 'CALL', 'PUT'] as Side[]).map(s => ({ label: SIDE_LABEL[s], patch: { side: s } })),
            };
        case 'barrier': {
            const [lo, hi] = barrierRange(d.side!);
            return { text: `Which digit for ${SIDE_LABEL[d.side!]}? Use ${lo} to ${hi}.`, chips: numChips(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), 'barrier') };
        }
        case 'stake':
            return { text: `How much per trade? The minimum is ${MIN_STAKE}.`, chips: numChips([0.35, 1, 2, 5, 10], 'stake') };
        case 'duration': {
            const [lo, hi] = durationRange(d.side);
            return { text: `How many ticks per trade? ${d.side === 'CALL' || d.side === 'PUT' ? `Rise and Fall need ${lo} to ${hi}.` : `Use ${lo} to ${hi}.`}`, chips: numChips(lo === 5 ? [5, 6, 8, 10] : [1, 2, 3, 5, 10], 'duration') };
        }
        case 'progression':
            return {
                text: `What should the stake do after each trade?\n${PROGRESSIONS.map(p => `${p.label}: ${p.hint}`).join('\n')}`,
                chips: PROGRESSIONS.map(p => ({ label: p.label, patch: { progression: p.id } })),
            };
        case 'multiplier':
            return { text: 'What multiplier? 2 is the usual choice.', chips: numChips([1.5, 2, 2.5, 3], 'multiplier') };
        case 'unit':
            return { text: 'How big is one unit (in stake amounts)? 1 is the usual choice.', chips: numChips([1, 2, 3, 5], 'unit') };
        case 'maxStake': {
            const s = d.stake ?? 1;
            return {
                text: 'Do you want a maximum stake? A cap stops the stake growing past that amount.',
                chips: [{ label: 'No cap', patch: { maxStake: null } }, ...[5, 10, 20].map(m => ({ label: String(round2(s * m)), patch: { maxStake: round2(s * m) } }))],
            };
        }
        case 'takeProfit':
            return { text: 'Stop the bot when total profit reaches how much?', chips: [...numChips([5, 10, 20, 50], 'takeProfit'), { label: 'No limit', patch: { takeProfit: NO_LIMIT } }] };
        case 'stopLoss':
            return { text: 'Stop the bot when total loss reaches how much?', chips: [...numChips([10, 20, 50, 100], 'stopLoss'), { label: 'No limit', patch: { stopLoss: NO_LIMIT } }] };
        case 'entry':
            return { text: 'When should it enter a trade?', chips: [{ label: 'Every tick', patch: { entry: { mode: 'any' } } }, { label: 'Wait for a last digit', patch: { entry: { mode: 'digit' } } }] };
        case 'advanced': {
            const chips: Chip[] = [
                { label: 'No, keep it simple', patch: { advanced: true } },
                { label: 'Recover with another trade after a loss', patch: { advanced: true, recover: 'ask' } },
            ];
            if (canPickBest(d.side)) chips.push({ label: 'Pick the likelier side every trade', patch: { advanced: true, pickBest: true } });
            chips.push({ label: 'Change volatility after losses', patch: { advanced: true, switchAsk: true } });
            return { text: 'Do you want it to do anything smarter while it runs?\nFor example: recover a loss with a different trade, choose between two sides by which one is more likely, or move to another volatility after losses.', chips };
        }
        case 'recoverKind': {
            const digit = d.side !== 'CALL' && d.side !== 'PUT';
            return {
                text: `After a loss, what should it trade until it wins again?${digit ? '' : ''}`,
                chips: [
                    { label: `The opposite (${SIDE_LABEL[oppositeOf(d.side!)]})`, patch: { recover: 'opposite' } },
                    { label: 'Even or Odd, the likelier one', patch: { recover: 'best', recoverFamily: 'evenodd' } },
                    { label: 'Over or Under, the likelier one', patch: { recover: 'best', recoverFamily: 'overunder' } },
                    { label: 'One specific trade', patch: { recover: 'fixed' } },
                ],
            };
        }
        case 'recoverSide':
            return { text: 'Which trade should it recover with?', chips: (['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'] as Side[]).map(s => ({ label: SIDE_LABEL[s], patch: { recoverSide: s } })) };
        case 'recoverBarrier': {
            const ou = d.recover === 'best';
            const [lo, hi] = ou ? [1, 8] : barrierRange(d.recoverSide!);
            return { text: ou ? `Which digit for the Over / Under recovery? Use ${lo} to ${hi}.` : `Which digit for ${SIDE_LABEL[d.recoverSide!]}? Use ${lo} to ${hi}.`, chips: numChips(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), 'recoverBarrier') };
        }
        case 'switchAfter':
            return { text: 'Move to the next volatility after how many losses in a row?', chips: numChips([1, 2, 3, 5], 'switchAfter') };
        case 'switchMarkets': {
            const others = (ids: string[]) => ids.filter(i => i !== d.symbol);
            const presets: [string, string[]][] = [['Vol 10, 25, 50', ['R_10', 'R_25', 'R_50']], ['Vol 50, 75, 100', ['R_50', 'R_75', 'R_100']], ['All five (10 to 100)', ['R_10', 'R_25', 'R_50', 'R_75', 'R_100']]];
            return {
                text: `It starts on ${marketLabel(d.symbol!)}. Which other volatilities should it move through? Pick one or type them, like "vol 25 and vol 75".`,
                chips: presets.map(([label, ids]) => ({ label, patch: { switchMarkets: others(ids) } })),
            };
        }
        case 'entryDigit':
            return {
                text: "Which last digit should it wait for? You can say 'equals 4', 'over 5' or 'under 3'.",
                chips: [...Array.from({ length: 10 }, (_, i) => ({ label: `= ${i}`, patch: { entry: { mode: 'digit' as const, op: 'EQ' as const, digit: i } } })), { label: 'over 5', patch: { entry: { mode: 'digit', op: 'GT', digit: 5 } } }, { label: 'under 4', patch: { entry: { mode: 'digit', op: 'LT', digit: 4 } } }],
            };
    }
};

const RELEVANT: Record<Slot, (keyof Draft)[]> = {
    symbol: ['symbol'], side: ['side'], barrier: ['barrier'], stake: ['stake'], duration: ['duration'], progression: ['progression'], multiplier: ['multiplier'],
    unit: ['unit'], maxStake: ['maxStake'], takeProfit: ['takeProfit'], stopLoss: ['stopLoss'], entry: ['entry'], entryDigit: ['entry'],
    advanced: ['advanced'], recoverKind: ['recover'], recoverSide: ['recoverSide'], recoverBarrier: ['recoverBarrier'], switchAfter: ['switchAfter'], switchMarkets: ['switchMarkets'],
};

/** Everything recognised in the text; a bare answer to the pending question is read only when nothing else was found. */
const interpret = (text: string, expecting: Slot | null): Draft => {
    // Answers to the entry questions use the same words as trade types ("over 5", "under 3"), so read them as entry rules first.
    if (expecting === 'entry' || expecting === 'entryDigit') {
        const a = parseAnswer(expecting, text);
        if (a.entry) return a;
    }
    if (expecting && ['advanced', 'recoverKind', 'recoverSide', 'recoverBarrier', 'switchAfter', 'switchMarkets'].includes(expecting)) {
        const a = parseAnswer(expecting, text);
        if (Object.keys(a).length) return a;
    }
    const patch = extract(text, { looseStake: !expecting || expecting === 'symbol' });
    if (expecting && Object.keys(patch).length === 0) return parseAnswer(expecting, text);
    return patch;
};

const merge = (d: Draft, patch: Draft): Draft => {
    const out: Draft = { ...d };
    (Object.keys(patch) as (keyof Draft)[]).forEach(k => {
        if (patch[k] !== undefined) (out as Record<string, unknown>)[k] = patch[k];
    });
    return out;
};

/** Drops values that don't make sense and explains why in plain words. */
const sanitize = (d: Draft, notes: string[]): Draft => {
    const o: Draft = { ...d };
    if (o.side && !needsBarrier(o.side)) delete o.barrier;
    if (o.side && needsBarrier(o.side) && o.barrier !== undefined) {
        const [lo, hi] = barrierRange(o.side);
        if (!Number.isInteger(o.barrier) || o.barrier < lo || o.barrier > hi) { notes.push(`${SIDE_LABEL[o.side]} needs a digit from ${lo} to ${hi}.`); delete o.barrier; }
    }
    if (o.stake !== undefined) {
        if (!(o.stake >= MIN_STAKE)) { notes.push(`The minimum stake is ${MIN_STAKE}.`); delete o.stake; } else o.stake = round2(o.stake);
    }
    if (o.duration !== undefined) {
        const [lo, hi] = durationRange(o.side);
        if (!Number.isInteger(o.duration) || o.duration < lo || o.duration > hi) { notes.push(`Duration must be a whole number of ticks from ${lo} to ${hi}${o.side === 'CALL' || o.side === 'PUT' ? ' for Rise and Fall' : ''}.`); delete o.duration; }
    }
    if (o.multiplier !== undefined && !(o.multiplier > 1 && o.multiplier <= 10)) { notes.push('The multiplier must be above 1 and no more than 10.'); delete o.multiplier; }
    if (o.unit !== undefined && !(o.unit > 0 && o.unit <= 20)) { notes.push('The unit must be between 0 and 20.'); delete o.unit; }
    if (typeof o.maxStake === 'number') {
        if (o.stake !== undefined && o.maxStake < o.stake) { notes.push('The maximum stake can\'t be lower than the stake.'); delete o.maxStake; } else o.maxStake = round2(o.maxStake);
    }
    for (const k of ['takeProfit', 'stopLoss'] as const) if (o[k] !== undefined && !(o[k]! > 0)) { notes.push(`${k === 'takeProfit' ? 'Take profit' : 'Stop loss'} must be more than 0.`); delete o[k]; }
    if (o.entry?.mode === 'digit' && o.entry.digit !== undefined && !(Number.isInteger(o.entry.digit) && o.entry.digit >= 0 && o.entry.digit <= 9)) { notes.push('The last digit must be 0 to 9.'); o.entry = { mode: 'digit' }; }
    // ---- smart options ----
    const bad = (sd?: Side, b?: number) => (sd === 'DIGITOVER' && b === 9) || (sd === 'DIGITUNDER' && b === 0) || (sd === 'DIGITOVER' && b === 0 && false);
    if (o.pickBest && !canPickBest(o.side)) { if (o.side) notes.push('Picking the likelier side works with Even, Odd, Over and Under only.'); delete o.pickBest; }
    if ((o.pickBest || o.recover === 'opposite') && o.side && o.barrier !== undefined && bad(oppositeOf(o.side), o.barrier)) {
        notes.push(`${SIDE_LABEL[oppositeOf(o.side)]} ${o.barrier} can never win, so it can't be the other side. Pick a different digit.`);
        delete o.barrier; delete o.pickBest; if (o.recover === 'opposite') delete o.recover;
    }
    if ((o.side === 'CALL' || o.side === 'PUT') && o.recover && o.recover !== 'opposite') { notes.push('Rise and Fall bots can only recover with the opposite (Fall or Rise).'); o.recover = 'opposite'; delete o.recoverSide; delete o.recoverFamily; delete o.recoverBarrier; }
    if (o.recover === 'ask' && (o.side === 'CALL' || o.side === 'PUT')) o.recover = 'opposite';
    if (o.recover === 'fixed' && (o.recoverSide === 'CALL' || o.recoverSide === 'PUT')) { notes.push('Recovery needs a digit trade.'); delete o.recoverSide; }
    if (o.recoverBarrier !== undefined) {
        const [lo, hi] = o.recover === 'best' ? [1, 8] : o.recoverSide ? barrierRange(o.recoverSide) : [0, 9];
        if (!Number.isInteger(o.recoverBarrier) || o.recoverBarrier < lo || o.recoverBarrier > hi) { notes.push(`The recovery digit must be from ${lo} to ${hi}.`); delete o.recoverBarrier; }
    }
    if (o.recover === 'opposite' || o.recover === 'ask') { delete o.recoverSide; delete o.recoverFamily; delete o.recoverBarrier; }
    if (o.recover === 'fixed') delete o.recoverFamily;
    if (o.switchAfter !== undefined && !(Number.isInteger(o.switchAfter) && o.switchAfter >= 1 && o.switchAfter <= 20)) { notes.push('Use a whole number of losses from 1 to 20.'); delete o.switchAfter; }
    if (o.switchMarkets) { o.switchMarkets = o.switchMarkets.filter(m => m !== o.symbol); if (!o.switchMarkets.length) delete o.switchMarkets; }
    if (advancedOn(o) && o.progression && o.progression !== 'flat' && o.progression !== 'martingale') {
        notes.push('Smart bots use a flat stake or martingale, so I set martingale x2. Say "no martingale" for a flat stake.');
        o.progression = 'martingale'; o.multiplier = 2; delete o.unit;
    }
    if (o.name !== undefined && !o.name.trim()) delete o.name;
    return o;
};

const CHANGEABLE: { label: string; clear: (keyof Draft)[] }[] = [
    { label: 'Market', clear: ['symbol'] }, { label: 'Trade', clear: ['side', 'barrier'] }, { label: 'Stake', clear: ['stake'] }, { label: 'Duration', clear: ['duration'] },
    { label: 'Stake plan', clear: ['progression', 'multiplier', 'unit', 'maxStake'] }, { label: 'Take profit', clear: ['takeProfit'] }, { label: 'Stop loss', clear: ['stopLoss'] }, { label: 'Entry', clear: ['entry'] },
    { label: 'Smart options', clear: ADV_KEYS },
];

const readable = (d: Draft) => summaryRows(d).filter(r => r.value).map(r => `${r.label}: ${r.value}`).join('\n');
const ack = (before: Draft, after: Draft): string | null => {
    const b = summaryRows(before), a = summaryRows(after);
    const old = new Map(b.map(r => [r.label, r.value]));
    const changed = a.filter(r => r.value && r.value !== old.get(r.label)).map(r => `${r.label.toLowerCase()} ${r.value}`);
    return changed.length ? `Noted: ${changed.join(', ')}.` : null;
};

export const opening = (): Turn => ({
    draft: {},
    say: ['Tell me about the bot you want. Type it or use the microphone.\nFor example: "Over 3 on Volatility 100, 1 tick, stake 0.5, martingale x2, take profit 10, stop loss 20".\nAnything you leave out, I\'ll ask you about.'],
    chips: [
        { label: 'Even, Vol 50, no martingale', text: 'Even on Volatility 50, 1 tick, stake 1, no martingale' },
        { label: 'Over 2 with martingale', text: 'Over 2 on Volatility 100 (1s), 1 tick, martingale x2' },
        { label: 'Even, recover on Odd', text: 'Even on Volatility 50, 1 tick, stake 1, martingale x2, recover on odd, take profit 10, stop loss 30' },
        { label: 'Rise, Vol 75, 5 ticks', text: 'Rise on Volatility 75, 5 ticks, stake 2' },
    ],
    expecting: 'symbol',
    complete: false,
});

export const step = (prev: Draft, input: Input, expecting: Slot | null): Turn => {
    if (input.action === 'restart' || (input.text && RESTART.test(input.text))) return opening();
    if (input.action === 'change') return { draft: prev, say: ['Which setting do you want to change?'], chips: CHANGEABLE.map(c => ({ label: c.label, clear: c.clear })), expecting: null, complete: true };
    if (input.action === 'create' || (isComplete(prev) && nextSlot(prev) === null && input.text && YES.test(input.text))) return { draft: prev, say: [], chips: [], expecting: null, complete: true, create: true };

    let d: Draft = { ...prev };
    input.clear?.forEach(k => delete d[k]);
    if (input.patch) d = merge(d, input.patch);
    if (input.text) d = merge(d, interpret(input.text, expecting));
    const notes: string[] = [];
    d = sanitize(d, notes);

    const say = [...notes];
    const same = JSON.stringify(d) === JSON.stringify(prev);
    const a = ack(prev, d);
    if (a) say.push(a);
    if (d.stopLoss === NO_LIMIT && prev.stopLoss !== NO_LIMIT) say.push('With no stop loss, the bot keeps trading until you stop it yourself.');
    if (d.maxStake === null && prev.maxStake !== null && (d.progression === 'martingale' || d.progression === 'reverse_martingale')) say.push('Without a cap, a long streak can grow the stake quickly.');

    const slot = nextSlot(d);
    if (!slot) {
        say.push(`That's everything. Here is the bot:\n${readable(d)}`);
        return { draft: d, say, chips: [{ label: 'Create bot', action: 'create' }, { label: 'Change something', action: 'change' }], expecting: null, complete: true };
    }
    if (same && !notes.length && input.text) say.unshift("I couldn't read that as an answer.");
    const q = question(slot, d);
    say.push(q.text);
    return { draft: d, say, chips: q.chips, expecting: slot, complete: false };
};

export { describe };
