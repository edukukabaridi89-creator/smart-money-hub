/**
 * Request for any Deriv contract type. Nothing here restricts the contract type: the broker validates it.
 * Only the fields that are set are sent, so digits, Rise/Fall (any duration unit), Higher/Lower, Touch, Ends In/Out,
 * Stays In/Goes Out, Asians, Lookbacks, Reset, Multipliers, Accumulators, Turbos, Vanillas etc. all use the same path.
 */
export type BuyRequest = {
    symbol: string;
    contract_type: string; // e.g. CALL, PUT, DIGITOVER, ONETOUCH, EXPIRYRANGE, MULTUP, ACCU, TURBOSLONG, VANILLALONGCALL ...
    stake: number; // `amount` of the request: the stake, or the payout when basis is 'payout'
    basis?: 'stake' | 'payout';
    maxPrice?: number; // highest price you accept to pay (defaults to the stake)
    duration?: number | null; // undefined = 1 tick; null = no duration (multipliers, accumulators, ...)
    duration_unit?: string; // t | s | m | h | d (default t)
    barrier?: number | string;
    barrier2?: number | string; // second barrier (range contracts)
    multiplier?: number;
    growth_rate?: number; // accumulators
    limit_order?: { take_profit?: number; stop_loss?: number };
    deal_cancellation?: string; // multipliers, e.g. '5m'
    selected_tick?: number; // tick high / low
    date_start?: number;
};

const has = (v: unknown) => v !== undefined && v !== null && v !== '';

/** Single place that builds `buy.parameters`, using the field names the vendored trade engine already uses. */
export const buyParameters = (r: BuyRequest, currency: string) => {
    const p: Record<string, unknown> = {
        amount: r.stake,
        basis: r.basis ?? 'stake',
        contract_type: r.contract_type,
        currency,
        underlying_symbol: r.symbol,
    };
    if (r.duration !== null) {
        p.duration = r.duration ?? 1;
        p.duration_unit = r.duration_unit ?? 't';
    }
    if (has(r.barrier)) p.barrier = String(r.barrier);
    if (has(r.barrier2)) p.barrier2 = String(r.barrier2);
    if (has(r.multiplier)) p.multiplier = r.multiplier;
    if (has(r.growth_rate)) p.growth_rate = r.growth_rate;
    if (has(r.limit_order)) p.limit_order = r.limit_order;
    if (has(r.deal_cancellation)) p.deal_cancellation = r.deal_cancellation;
    if (has(r.selected_tick)) p.selected_tick = r.selected_tick;
    if (has(r.date_start)) p.date_start = r.date_start;
    return p;
};
