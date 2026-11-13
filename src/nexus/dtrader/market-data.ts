import { api_base } from '@/external/bot-skeleton';
import { hub } from '../ticks-hub';

/** Uses the logged-in connection when there is one, otherwise the public socket. */
const send = (payload: Record<string, unknown>): Promise<any> => (api_base.api ? Promise.resolve(api_base.api.send(payload)) : hub.call(payload));

const cache = new Map<string, { at: number; list: any[] }>();
/** Raw `contracts_for` list for a market (what the broker offers there), cached for 10 minutes. */
export const getAvailable = async (symbol: string): Promise<any[]> => {
    const hit = cache.get(symbol);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.list;
    try {
        const res: any = await send({ contracts_for: symbol });
        const list: any[] = res?.contracts_for?.available ?? [];
        if (list.length) cache.set(symbol, { at: Date.now(), list });
        return list;
    } catch {
        return [];
    }
};

export type Quote = { ok: true; payout: number; cost: number; details: any } | { ok: false; error: string };

/** A live price for one side of a trade (nothing is bought). */
export const fetchProposal = async (params: Record<string, unknown>): Promise<Quote> => {
    try {
        const res: any = await send({ proposal: 1, ...params });
        const p = res?.proposal;
        if (!p) return { ok: false, error: res?.error?.message ?? 'No price returned.' };
        return { ok: true, payout: Number(p.payout ?? 0), cost: Number(p.ask_price ?? 0), details: p };
    } catch (e: any) {
        return { ok: false, error: e?.error?.message ?? e?.message ?? 'The price could not be loaded.' };
    }
};
