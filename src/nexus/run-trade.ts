import { dispatch, TradeReq } from './dispatcher';
import { nexus } from './store';

/** Fire one trade through the unified dispatcher and surface any error as a toast. */
export const runTrade = async (req: TradeReq) => {
    const r = await dispatch(req);
    if (r.error) nexus.log(r.error);
    return r;
};
