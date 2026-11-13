import { api_base } from '@/external/bot-skeleton';
import { LogTypes } from '@/external/bot-skeleton/constants/messages';
import { observer as bus } from '@/external/bot-skeleton/utils/observer';
import { buyParameters, type BuyRequest } from './buy-params';
import { demoGuard } from './demo-limit';
import { positions } from './positions';
import { nexus } from './store';

export type TradeReq = BuyRequest & { source: string }; // source: hedge | bulk | manual | auto | ...
export type TradeResult = { contract_id?: number; profit?: number; won?: boolean; error?: string };

const open = new Map<number, (r: TradeResult) => void>();
let wired_api: unknown = null;

const send = (payload: object): Promise<any> =>
    Promise.resolve(api_base.api.send(payload)).catch((e: any) => ({ error: e?.error ?? { message: e?.message ?? 'Request failed' } }));

/** Same payload shape the trade engine broadcasts for every proposal_open_contract update. */
const onContractUpdate = ({ data }: any) => {
    const c = data?.proposal_open_contract;
    if (data?.msg_type !== 'proposal_open_contract' || !c) return;
    const done = open.get(c.contract_id);
    if (!done) return;

    bus.emit('bot.contract', { accountID: nexus.getLoginid(), ...c }); // -> Summary + Transactions
    positions.upsert(c);
    if (!c.is_sold) return;

    open.delete(c.contract_id);
    if (data.subscription?.id) send({ forget: data.subscription.id });
    const profit = Number(c.sell_price) - Number(c.buy_price);
    bus.emit('contract.status', { id: 'contract.sold', data: c.transaction_ids?.sell, contract: c });
    bus.emit('ui.log.success', { log_type: profit > 0 ? LogTypes.PROFIT : LogTypes.LOST, extra: { currency: c.currency, profit: Number(profit.toFixed(2)) } }); // -> Journal
    nexus.endTrade();
    done({ contract_id: c.contract_id, profit, won: profit > 0 });
};

/**
 * THE single entry point for every trade placed outside Bot Builder. It follows the exact event sequence the
 * trade engine uses (Purchase.js + OpenContract.js), so the trade shows up in Summary, Transactions and Journal
 * as if the bot had placed it. The buy request is sent synchronously (no awaits before it).
 */
export const dispatch = (req: TradeReq): Promise<TradeResult> => {
    if (!api_base.api) return Promise.resolve({ error: 'Not connected — log in first.' });
    if (demoGuard()) return Promise.resolve({ error: 'Demo limit reached. It resets in a few hours, or switch to a real account.' });
    if (wired_api !== api_base.api) {
        wired_api = api_base.api; // re-wire after account switches / reconnects
        api_base.api.onMessage().subscribe(onContractUpdate);
    }
    const currency = (api_base.account_info as any)?.currency || nexus.root?.client?.currency || 'USD';

    nexus.beginTrade();
    bus.emit('contract.status', { id: 'contract.purchase_sent', data: req.stake });
    nexus.mirror({ ...req, currency }); // copy-trading followers get the identical order
    const pending = send({ buy: 1, price: req.maxPrice ?? req.stake, parameters: buyParameters(req, currency) });

    return pending.then(async (res: any) => {
        if (res?.error) {
            bus.emit('ui.log.notify', { className: 'error', message: res.error.message, sound: 'silent' }); // -> Journal
            nexus.endTrade();
            return { error: res.error.message as string };
        }
        const buy = res?.buy;
        if (!buy) { nexus.endTrade(); return { error: 'No purchase confirmation received' }; }
        bus.emit('contract.status', { id: 'contract.purchase_received', data: buy.transaction_id, buy });
        bus.emit('ui.log.success', { log_type: LogTypes.PURCHASE, extra: { transaction_id: buy.transaction_id, buy_price: Number(buy.buy_price), currency } });
        bus.emit('bot.contract', {
            accountID: nexus.getLoginid(),
            contract_id: buy.contract_id,
            buy_price: buy.buy_price,
            date_start: buy.start_time,
            contract_type: req.contract_type,
            underlying: req.symbol,
            shortcode: buy.shortcode,
            transaction_ids: { buy: buy.transaction_id },
            payout: buy.payout,
            currency,
            is_sold: 0,
        });
        positions.upsert({ contract_id: buy.contract_id, contract_type: req.contract_type, underlying: req.symbol, buy_price: buy.buy_price, is_sold: 0 });
        return new Promise<TradeResult>(resolve => {
            open.set(buy.contract_id, resolve);
            send({ proposal_open_contract: 1, contract_id: buy.contract_id, subscribe: 1 });
        });
    });
};
