import type { BuyRequest } from '../buy-params';

/** The trade types of the Deriv trader, with the settings each one shows. Nothing here talks to the network. */
export type Unit = 't' | 's' | 'm' | 'h' | 'd';
export type Field = 'ticks' | 'duration' | 'prediction' | 'barrier' | 'growth' | 'multiplier' | 'takeProfit' | 'stopLoss' | 'dealCancel' | 'basis';
export type TradeSide = { label: string; contract_type: string; tone: 'up' | 'down' };
export type TradeTypeDef = {
    id: string;
    label: string;
    group: 'Accumulators' | 'Digits' | 'Ups & Downs' | 'Touch & No Touch' | 'Multipliers' | 'Turbos' | 'Vanillas';
    category: 'Options' | 'Multipliers' | 'Accumulators';
    sides: TradeSide[];
    fields: Field[];
    units?: Unit[];
    about: string;
};

const up = (label: string, contract_type: string): TradeSide => ({ label, contract_type, tone: 'up' });
const down = (label: string, contract_type: string): TradeSide => ({ label, contract_type, tone: 'down' });

export const TRADE_TYPES: TradeTypeDef[] = [
    { id: 'accumulators', label: 'Accumulators', group: 'Accumulators', category: 'Accumulators', sides: [up('Buy', 'ACCU')], fields: ['growth', 'takeProfit'], about: 'Your stake grows by the growth rate with every tick the price stays inside the barrier range. The contract ends if the price leaves the range.' },
    { id: 'matchesdiffers', label: 'Matches/Differs', group: 'Digits', category: 'Options', sides: [up('Matches', 'DIGITMATCH'), down('Differs', 'DIGITDIFF')], fields: ['ticks', 'prediction', 'basis'], about: 'Matches wins if the last digit of the final tick equals your digit. Differs wins if it does not.' },
    { id: 'evenodd', label: 'Even/Odd', group: 'Digits', category: 'Options', sides: [up('Even', 'DIGITEVEN'), down('Odd', 'DIGITODD')], fields: ['ticks', 'basis'], about: 'Even wins if the last digit of the final tick is even, Odd wins if it is odd.' },
    { id: 'overunder', label: 'Over/Under', group: 'Digits', category: 'Options', sides: [up('Over', 'DIGITOVER'), down('Under', 'DIGITUNDER')], fields: ['ticks', 'prediction', 'basis'], about: 'Over wins if the last digit is higher than your digit, Under wins if it is lower.' },
    { id: 'risefall', label: 'Rise/Fall', group: 'Ups & Downs', category: 'Options', sides: [up('Rise', 'CALL'), down('Fall', 'PUT')], fields: ['duration', 'basis'], units: ['t', 's', 'm', 'h', 'd'], about: 'Rise wins if the exit price is higher than the entry price, Fall wins if it is lower.' },
    { id: 'higherlower', label: 'Higher/Lower', group: 'Ups & Downs', category: 'Options', sides: [up('Higher', 'CALL'), down('Lower', 'PUT')], fields: ['duration', 'barrier', 'basis'], units: ['s', 'm', 'h', 'd'], about: 'Higher wins if the exit price is above your barrier, Lower wins if it is below it.' },
    { id: 'touchnotouch', label: 'Touch/No Touch', group: 'Touch & No Touch', category: 'Options', sides: [up('Touch', 'ONETOUCH'), down('No Touch', 'NOTOUCH')], fields: ['duration', 'barrier', 'basis'], units: ['t', 's', 'm', 'h', 'd'], about: 'Touch wins if the price touches your barrier at any time. No Touch wins if it never does.' },
    { id: 'multipliers', label: 'Multipliers', group: 'Multipliers', category: 'Multipliers', sides: [up('Up', 'MULTUP'), down('Down', 'MULTDOWN')], fields: ['multiplier', 'takeProfit', 'stopLoss', 'dealCancel'], about: 'Your profit or loss is the price move multiplied by the multiplier. Your loss is limited to your stake.' },
    { id: 'turbos', label: 'Turbos', group: 'Turbos', category: 'Options', sides: [up('Up', 'TURBOSLONG'), down('Down', 'TURBOSSHORT')], fields: ['duration', 'barrier', 'takeProfit'], units: ['t', 's', 'm', 'h', 'd'], about: 'The payout grows with the price move beyond the barrier. The contract ends if the price touches the barrier.' },
    { id: 'vanillas', label: 'Call/Put', group: 'Vanillas', category: 'Options', sides: [up('Call', 'VANILLALONGCALL'), down('Put', 'VANILLALONGPUT')], fields: ['duration', 'barrier'], units: ['d', 'h', 'm'], about: 'Call pays if the exit price is above the strike, Put if it is below. The most you can lose is your stake.' },
];
export const GROUPS: TradeTypeDef['group'][] = ['Accumulators', 'Digits', 'Ups & Downs', 'Touch & No Touch', 'Multipliers', 'Turbos', 'Vanillas'];
export const typeById = (id: string) => TRADE_TYPES.find(t => t.id === id) ?? TRADE_TYPES[2];
export const UNIT_LABEL: Record<Unit, string> = { t: 'Ticks', s: 'Seconds', m: 'Minutes', h: 'Hours', d: 'Days' };

/**
 * Trade types the chosen market offers, from the raw `contracts_for` list. With no data (not loaded yet or not available)
 * every type is offered and the broker's answer decides. Rise/Fall and Higher/Lower share CALL/PUT; they differ by barrier category.
 */
export const availableTypes = (available: any[] | null | undefined): TradeTypeDef[] => {
    if (!available?.length) return TRADE_TYPES;
    const has = (ct: string, pred?: (c: any) => boolean) => available.some(c => c.contract_type === ct && (!pred || pred(c)));
    return TRADE_TYPES.filter(t => {
        const cts = t.sides.map(s => s.contract_type);
        if (t.id === 'risefall') return has('CALL', c => !c.barrier_category || c.barrier_category === 'euro_atm') && has('PUT');
        if (t.id === 'higherlower') return has('CALL', c => c.barrier_category === 'euro_non_atm') && has('PUT', c => c.barrier_category === 'euro_non_atm');
        return cts.every(ct => has(ct));
    });
};

export type Form = {
    basis: 'stake' | 'payout';
    amount: number;
    ticks: number;
    digit: number;
    durationValue: number;
    durationUnit: Unit;
    barrier: string;
    growth: number;
    multiplier: number;
    takeProfit: { on: boolean; amount: number };
    stopLoss: { on: boolean; amount: number };
    dealCancel: { on: boolean; option: string };
};

export const defaultForm = (t: TradeTypeDef): Form => ({
    basis: 'stake',
    amount: 10,
    ticks: 1,
    digit: 5,
    durationValue: t.id === 'risefall' ? 1 : t.id === 'turbos' ? 1 : t.id === 'vanillas' ? 1 : 5,
    durationUnit: t.id === 'risefall' || t.id === 'turbos' ? 't' : t.id === 'vanillas' ? 'd' : 'm',
    barrier: t.id === 'vanillas' ? '+10' : '+0.50',
    growth: 0.03,
    multiplier: 100,
    takeProfit: { on: false, amount: 10 },
    stopLoss: { on: false, amount: 10 },
    dealCancel: { on: false, option: '5m' },
});

/** Returns a plain-language problem with the form, or null if it can be sent. */
export const validate = (t: TradeTypeDef, f: Form): string | null => {
    if (!(f.amount > 0)) return 'Enter an amount above 0.';
    if (t.fields.includes('ticks') && !(Number.isInteger(f.ticks) && f.ticks >= 1 && f.ticks <= 10)) return 'Ticks must be 1 to 10.';
    if (t.fields.includes('prediction') && !(Number.isInteger(f.digit) && f.digit >= 0 && f.digit <= 9)) return 'The digit must be 0 to 9.';
    if (t.fields.includes('duration') && !(f.durationValue > 0)) return 'Enter a duration above 0.';
    if (t.fields.includes('barrier') && !f.barrier.trim()) return 'Enter a barrier.';
    if (t.fields.includes('takeProfit') && f.takeProfit.on && !(f.takeProfit.amount > 0)) return 'Take profit must be above 0.';
    if (t.fields.includes('stopLoss') && f.stopLoss.on && !(f.stopLoss.amount > 0)) return 'Stop loss must be above 0.';
    return null;
};

/** The request for one side of a trade type (same fields the proposal and the buy both use). */
export const requestFor = (t: TradeTypeDef, side: TradeSide, f: Form, symbol: string): BuyRequest => {
    const r: BuyRequest = { symbol, contract_type: side.contract_type, stake: f.amount, basis: t.fields.includes('basis') ? f.basis : 'stake' };
    if (t.fields.includes('ticks')) { r.duration = f.ticks; r.duration_unit = 't'; }
    else if (t.fields.includes('duration')) { r.duration = f.durationValue; r.duration_unit = f.durationUnit; }
    else r.duration = null; // multipliers and accumulators have no duration
    if (t.fields.includes('prediction')) r.barrier = String(f.digit);
    if (t.fields.includes('barrier')) r.barrier = f.barrier.trim();
    if (t.fields.includes('growth')) r.growth_rate = f.growth;
    if (t.fields.includes('multiplier')) r.multiplier = f.multiplier;
    const limits: { take_profit?: number; stop_loss?: number } = {};
    if (t.fields.includes('takeProfit') && f.takeProfit.on) limits.take_profit = f.takeProfit.amount;
    if (t.fields.includes('stopLoss') && f.stopLoss.on) limits.stop_loss = f.stopLoss.amount;
    if (Object.keys(limits).length) r.limit_order = limits;
    if (t.fields.includes('dealCancel') && f.dealCancel.on) r.deal_cancellation = f.dealCancel.option;
    return r;
};

/** Percentage return shown on each buy button: (payout - cost) / cost. */
export const returnPct = (payout: number, cost: number) => (cost > 0 ? ((payout - cost) / cost) * 100 : 0);
