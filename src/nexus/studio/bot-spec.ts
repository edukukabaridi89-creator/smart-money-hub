import { SYMBOLS, symbolName } from '../config';

export type Side = 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITMATCH' | 'DIGITDIFF' | 'CALL' | 'PUT';
export type Progression = 'flat' | 'martingale' | 'reverse_martingale' | 'dalembert' | 'reverse_dalembert' | 'oscars_grind' | 'one_three_two_six';
export type DigitOp = 'EQ' | 'GT' | 'LT';
export type Entry = { mode: 'any' } | { mode: 'digit'; op?: DigitOp; digit?: number };

/** Behaviour that changes while the bot runs (see advanced.ts). Present on a BotSpec only when something is switched on. */
export type AdvExtras = {
    pickBest: boolean; // every trade: take the side (of this and its opposite) that appeared more often in the last `window` ticks
    recovery: { mode: 'opposite' } | { mode: 'fixed'; side: Side; barrier?: number } | { mode: 'best'; family: 'evenodd' | 'overunder'; barrier?: number } | null;
    marketSwitch: { after: number; markets: string[] } | null;
    window: number;
};

/** Everything a bot needs. Fields marked optional are filled in only when they apply to the chosen strategy. */
export type BotSpec = {
    name: string;
    symbol: string;
    side: Side;
    barrier?: number; // digit for over / under / matches / differs
    stake: number;
    duration: number; // ticks
    progression: Progression;
    multiplier?: number; // martingale family
    unit?: number; // d'Alembert / Oscar's Grind
    maxStake?: number | null; // cap on how far the stake can grow
    takeProfit: number;
    stopLoss: number;
    entry: { mode: 'any' } | { mode: 'digit'; op: DigitOp; digit: number };
    adv?: AdvExtras;
};

/** A bot while the conversation is still collecting answers (null maxStake = "no cap" was answered). */
export type Draft = Partial<Omit<BotSpec, 'entry' | 'adv'>> & {
    entry?: Entry;
    // advanced behaviour, collected through follow-up questions
    advanced?: boolean; // the "anything smarter?" question has been answered
    pickBest?: boolean;
    recover?: 'ask' | 'opposite' | 'fixed' | 'best'; // 'ask' = wanted, kind not chosen yet
    recoverSide?: Side;
    recoverFamily?: 'evenodd' | 'overunder';
    recoverBarrier?: number;
    switchAsk?: boolean;
    switchAfter?: number;
    switchMarkets?: string[]; // the markets to rotate through after the start market
};
export const ADV_KEYS: (keyof Draft)[] = ['advanced', 'pickBest', 'recover', 'recoverSide', 'recoverFamily', 'recoverBarrier', 'switchAsk', 'switchAfter', 'switchMarkets'];

export const MIN_STAKE = 0.35;
export const NO_LIMIT = 1_000_000; // templates need a number; this is "never stop on this"

export const SIDE_LABEL: Record<Side, string> = {
    DIGITEVEN: 'Even', DIGITODD: 'Odd', DIGITOVER: 'Over', DIGITUNDER: 'Under', DIGITMATCH: 'Matches', DIGITDIFF: 'Differs', CALL: 'Rise', PUT: 'Fall',
};
export const needsBarrier = (side?: Side) => !!side && ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(side);
export const barrierRange = (side: Side): [number, number] => (side === 'DIGITOVER' ? [0, 8] : side === 'DIGITUNDER' ? [1, 9] : [0, 9]);
export const durationRange = (side?: Side): [number, number] => (side === 'CALL' || side === 'PUT' ? [5, 10] : [1, 10]);
/** How the trade type is named inside Bot Builder blocks. */
export const kindOf = (side: Side) => {
    const digit = side.startsWith('DIGIT');
    const tradetype = side === 'DIGITEVEN' || side === 'DIGITODD' ? 'evenodd' : side === 'DIGITOVER' || side === 'DIGITUNDER' ? 'overunder' : digit ? 'matchesdiffers' : 'callput';
    return { tradetype, tradetypecat: digit ? 'digits' : 'callput' };
};

export const PROGRESSIONS: { id: Progression; label: string; hint: string; param: 'multiplier' | 'unit' | null }[] = [
    { id: 'flat', label: 'Keep the stake the same', hint: 'Same stake every trade.', param: null },
    { id: 'martingale', label: 'Martingale', hint: 'Multiply the stake after a loss, go back to the start after a win.', param: 'multiplier' },
    { id: 'reverse_martingale', label: 'Reverse martingale', hint: 'Multiply the stake after a win, go back to the start after a loss.', param: 'multiplier' },
    { id: 'dalembert', label: "D'Alembert", hint: 'Add one unit after a loss, remove one after a win.', param: 'unit' },
    { id: 'reverse_dalembert', label: "Reverse D'Alembert", hint: 'Add one unit after a win, remove one after a loss.', param: 'unit' },
    { id: 'oscars_grind', label: "Oscar's Grind", hint: 'Raise the stake by one unit after a win until a small profit is locked in.', param: 'unit' },
    { id: 'one_three_two_six', label: '1-3-2-6', hint: 'Stake follows the 1, 3, 2, 6 pattern while you keep winning.', param: null },
];
export const progressionOf = (id?: Progression) => PROGRESSIONS.find(p => p.id === id);
/** 1-3-2-6 limits itself (the stake never passes 6x the base) and its template has no cap setting. */
export const supportsCap = (id?: Progression) => !!id && id !== 'flat' && id !== 'one_three_two_six';

/** The other side of the same bet (Even <-> Odd, Over d <-> Under d, Matches <-> Differs, Rise <-> Fall). */
export const oppositeOf = (side: Side): Side =>
    ({ DIGITEVEN: 'DIGITODD', DIGITODD: 'DIGITEVEN', DIGITOVER: 'DIGITUNDER', DIGITUNDER: 'DIGITOVER', DIGITMATCH: 'DIGITDIFF', DIGITDIFF: 'DIGITMATCH', CALL: 'PUT', PUT: 'CALL' } as Record<Side, Side>)[side];
/** Sides that can be picked "by chance" against their opposite. */
export const canPickBest = (side?: Side) => !!side && ['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER'].includes(side);
export const advancedOn = (d: Draft) => !!d.pickBest || !!d.recover || !!d.switchAsk || d.switchAfter !== undefined;

export const MARKETS = SYMBOLS;
export const marketLabel = (id: string) => symbolName(id);

const money = (n: number) => (n >= NO_LIMIT ? 'no limit' : n.toFixed(2).replace(/\.00$/, ''));
const OP_WORD: Record<DigitOp, string> = { EQ: 'is', GT: 'is over', LT: 'is under' };

export const tradeLabel = (d: Draft) =>
    d.side ? `${SIDE_LABEL[d.side]}${needsBarrier(d.side) && d.barrier !== undefined ? ` ${d.barrier}` : ''}` : undefined;

export const defaultName = (d: Draft) => [tradeLabel(d), d.symbol ? marketLabel(d.symbol) : undefined].filter(Boolean).join(' · ') || 'My bot';

/** One row per setting, for the summary panel. `value` is undefined while the setting is still missing. */
export const summaryRows = (d: Draft): { label: string; value?: string }[] => {
    const prog = progressionOf(d.progression);
    const plan = prog
        ? prog.label + (prog.param === 'multiplier' && d.multiplier ? ` ×${d.multiplier}` : '') + (prog.param === 'unit' && d.unit ? `, unit ${d.unit}` : '')
        : undefined;
    const cap = supportsCap(d.progression) ? (d.maxStake === undefined ? undefined : d.maxStake === null ? 'No cap' : `Cap ${money(d.maxStake)}`) : undefined;
    const entry = !d.entry ? undefined : d.entry.mode === 'any' ? 'Every tick' : d.entry.digit !== undefined && d.entry.op ? `Wait until last digit ${OP_WORD[d.entry.op]} ${d.entry.digit}` : undefined;
    const recovery = d.recover === 'opposite' ? 'Opposite trade'
        : d.recover === 'best' ? (d.recoverFamily === 'overunder' ? `Over/Under${d.recoverBarrier !== undefined ? ` ${d.recoverBarrier}` : ''}, the likelier` : 'Even/Odd, the likelier')
        : d.recover === 'fixed' && d.recoverSide ? `${SIDE_LABEL[d.recoverSide]}${needsBarrier(d.recoverSide) && d.recoverBarrier !== undefined ? ` ${d.recoverBarrier}` : ''}` : undefined;
    const advRows: { label: string; value?: string }[] = [
        ...(d.recover ? [{ label: 'Recovery after a loss', value: recovery }] : []),
        ...(d.pickBest ? [{ label: 'Picks', value: 'The likelier of the two, every trade' }] : []),
        ...(d.switchAsk || d.switchAfter !== undefined
            ? [{ label: 'Switch market', value: d.switchAfter !== undefined && d.switchMarkets?.length ? `After ${d.switchAfter} loss${d.switchAfter === 1 ? '' : 'es'}: ${[d.symbol, ...d.switchMarkets].filter(Boolean).map(m => marketLabel(m as string)).join(' → ')}` : undefined }]
            : []),
    ];
    return [
        { label: 'Market', value: d.symbol ? marketLabel(d.symbol) : undefined },
        { label: 'Trade', value: tradeLabel(d) },
        { label: 'Stake', value: d.stake !== undefined ? money(d.stake) : undefined },
        { label: 'Duration', value: d.duration !== undefined ? `${d.duration} tick${d.duration === 1 ? '' : 's'}` : undefined },
        { label: 'After a loss / win', value: plan && (cap ? `${plan} · ${cap}` : plan) },
        { label: 'Take profit', value: d.takeProfit !== undefined ? money(d.takeProfit) : undefined },
        { label: 'Stop loss', value: d.stopLoss !== undefined ? money(d.stopLoss) : undefined },
        { label: 'Entry', value: entry },
        ...advRows,
    ];
};

/** True once every setting that applies has an answer. */
export const isComplete = (d: Draft): boolean => {
    if (!d.symbol || !d.side || d.stake === undefined || d.duration === undefined || !d.progression) return false;
    if (needsBarrier(d.side) && d.barrier === undefined) return false;
    const prog = progressionOf(d.progression)!;
    if (prog.param === 'multiplier' && d.multiplier === undefined) return false;
    if (prog.param === 'unit' && d.unit === undefined) return false;
    if (supportsCap(d.progression) && d.maxStake === undefined) return false;
    if (d.takeProfit === undefined || d.stopLoss === undefined) return false;
    if (!d.entry || (d.entry.mode === 'digit' && (d.entry.op === undefined || d.entry.digit === undefined))) return false;
    if (d.pickBest && !canPickBest(d.side)) return false;
    if (d.recover === 'ask') return false;
    if (d.recover === 'fixed' && (!d.recoverSide || (needsBarrier(d.recoverSide) && d.recoverBarrier === undefined))) return false;
    if (d.recover === 'best' && (!d.recoverFamily || (d.recoverFamily === 'overunder' && d.recoverBarrier === undefined))) return false;
    if (d.switchAsk || d.switchAfter !== undefined) {
        if (d.switchAfter === undefined || (d.switchMarkets?.length ?? 0) < 1) return false;
    }
    if (advancedOn(d) && d.progression && d.progression !== 'flat' && d.progression !== 'martingale') return false;
    return true;
};

const adv = (d: Draft): AdvExtras | undefined => {
    if (!advancedOn(d)) return undefined;
    const rec: AdvExtras['recovery'] = d.recover === 'opposite' ? { mode: 'opposite' }
        : d.recover === 'fixed' ? { mode: 'fixed', side: d.recoverSide!, barrier: needsBarrier(d.recoverSide) ? d.recoverBarrier : undefined }
        : d.recover === 'best' ? { mode: 'best', family: d.recoverFamily!, barrier: d.recoverFamily === 'overunder' ? d.recoverBarrier : undefined } : null;
    const markets = [...new Set([d.symbol!, ...(d.switchMarkets ?? [])])];
    return { pickBest: !!d.pickBest, recovery: rec, marketSwitch: d.switchAfter !== undefined && markets.length > 1 ? { after: d.switchAfter, markets } : null, window: 100 };
};

/** A finished bot from a complete draft. */
export const finalize = (d: Draft, name?: string): BotSpec => ({
    adv: adv(d),
    name: (name ?? d.name ?? '').trim() || defaultName(d),
    symbol: d.symbol!, side: d.side!, barrier: needsBarrier(d.side) ? d.barrier : undefined,
    stake: d.stake!, duration: d.duration!, progression: d.progression!,
    multiplier: progressionOf(d.progression)?.param === 'multiplier' ? d.multiplier : undefined,
    unit: progressionOf(d.progression)?.param === 'unit' ? d.unit : undefined,
    maxStake: supportsCap(d.progression) ? d.maxStake ?? null : null,
    takeProfit: d.takeProfit!, stopLoss: d.stopLoss!,
    entry: d.entry!.mode === 'any' ? { mode: 'any' } : { mode: 'digit', op: d.entry!.op!, digit: d.entry!.digit! },
});

/** One-line description for cards and the chat. */
export const describe = (s: BotSpec): string => {
    const rows = summaryRows(s);
    const get = (l: string) => rows.find(r => r.label === l)?.value;
    return [get('Market'), get('Trade'), `stake ${get('Stake')}`, get('Duration'), get('After a loss / win'), get('Recovery after a loss'), get('Picks'), get('Switch market'), `TP ${get('Take profit')}`, `SL ${get('Stop loss')}`, get('Entry') === 'Every tick' ? undefined : get('Entry')]
        .filter(Boolean)
        .join(' · ');
};
