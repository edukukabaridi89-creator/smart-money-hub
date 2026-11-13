import { makeAutoObservable } from 'mobx';
import { api_base } from '@/external/bot-skeleton';
import { nexus } from './store';

export type Position = { id: number; type: string; symbol: string; buyPrice: number; bid: number; profit: number; sellable: boolean; closed: boolean };

/** Contracts opened from the trade pages, for the "open positions" list (with Close). */
class PositionsStore {
    list: Position[] = [];
    constructor() {
        makeAutoObservable(this);
    }
    upsert = (c: any) => {
        const next: Position = {
            id: c.contract_id,
            type: c.contract_type,
            symbol: c.underlying ?? c.underlying_symbol ?? '',
            buyPrice: Number(c.buy_price),
            bid: Number(c.bid_price ?? 0),
            profit: Number(c.profit ?? 0),
            sellable: !!Number(c.is_valid_to_sell) && !c.is_sold,
            closed: !!c.is_sold,
        };
        const i = this.list.findIndex(p => p.id === next.id);
        if (i >= 0) this.list[i] = next;
        else this.list.unshift(next);
        if (next.closed) setTimeout(() => this.remove(next.id), 4000);
    };
    remove = (id: number) => {
        this.list = this.list.filter(p => p.id !== id);
    };
}
export const positions = new PositionsStore();

/** Sells (closes) an open contract at the current price. */
export const sellPosition = async (id: number) => {
    try {
        const res: any = await api_base.api?.send({ sell: id, price: 0 });
        if (res?.error) nexus.log(res.error.message);
    } catch (e: any) {
        nexus.log(e?.error?.message ?? 'The contract could not be closed.');
    }
};
