/* eslint-disable no-promise-executor-return */
import debounce from 'lodash.debounce';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { localize } from '@deriv-com/translations';
import { getLast } from '../../../utils/binary-utils';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { notify } from '../utils/broadcast';
import { getDirection, getLastDigit } from '../utils/helpers';
import { expectPositiveInteger } from '../utils/sanitize';
import * as constants from './state/constants';

let tickListenerKey;

const SCAN_SYMBOLS = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V'];
const SCAN_TTL_MS = 15000;
let scan_cache = { at: 0, count: 0, data: {} };

const digitPct = (digits, kind, d) => {
    if (!digits.length) return 0;
    const hit = {
        EVEN: x => x % 2 === 0,
        ODD: x => x % 2 === 1,
        OVER: x => x > d,
        UNDER: x => x < d,
    };
    const pct = k => (digits.filter(hit[k]).length * 100) / digits.length;
    if (kind === 'ANY') return Math.max(pct('EVEN'), pct('ODD'), pct('OVER'), (digits.filter(x => x < d + 1).length * 100) / digits.length);
    return pct(kind);
};

export default Engine =>
    class Ticks extends Engine {
        async watchTicks(symbol) {
            if (symbol && this.symbol !== symbol) {
                this.symbol = symbol;
                const { ticksService } = this.$scope;

                await ticksService.stopMonitor({
                    symbol,
                    key: tickListenerKey,
                });
                const callback = ticks => {
                    if (this.is_proposal_subscription_required) {
                        this.checkProposalReady();
                    }
                    const lastTick = ticks.slice(-1)[0];
                    const { epoch } = lastTick;
                    this.noteWaiting(lastTick);
                    this.store.dispatch({ type: constants.NEW_TICK, payload: epoch });
                };

                const key = await ticksService.monitor({ symbol, callback });
                tickListenerKey = key;
            }
        }

        /* Nexus: tell the Journal what the bot is doing while it waits (no trade for 20 s), so the user can see it has not hung. */
        noteWaiting(tick) {
            try {
                const now = Date.now();
                if (!this.wait_note_started) this.wait_note_started = now;
                if (this.store.getState().scope !== constants.BEFORE_PURCHASE) return;
                const since = Math.max(this.last_activity_at || this.wait_note_started, this.last_wait_note_at || 0);
                if (now - since < 20000) return;
                this.last_wait_note_at = now;
                const symbol = this.symbol || this.options?.symbol;
                const digit = getLastDigit(Number(tick.quote).toFixed(this.getPipSize()));
                notify('info', `Still running. Waiting for the entry condition on ${symbol} (latest last digit: ${digit}). No trade has been placed yet; the bot will buy as soon as the condition is met.`);
            } catch (e) {
                // the Journal note is optional
            }
        }

        /* Nexus: move the bot to another market while it is running (used by the "Switch trade" block).
         * Stops listening to the old market and starts the new one; Bot.getLastDigit() etc. follow the new market. */
        async switchSymbol(symbol) {
            if (!symbol || symbol === this.symbol) return;
            const { ticksService } = this.$scope;
            const old_symbol = this.symbol;
            if (old_symbol && tickListenerKey) {
                await ticksService.stopMonitor({ symbol: old_symbol, key: tickListenerKey });
            }
            this.symbol = null; // lets watchTicks run for the new market
            await this.watchTicks(symbol);
        }

        /* Nexus: scan the last `count` ticks of every volatility market (scope 'all') or just the current one and move to the
         * market where `kind` appears most. Returns the market moved to, or '' if none clears `threshold`.
         * Uses plain ticks_history requests (4 at a time) and keeps the result for 15 s so it is cheap to call every trade. */
        async scanMarkets(opts = {}) {
            const { scope = 'all', kind = 'EVEN', digit = 5, count = 100, condition = 'ABOVE', threshold = 0 } = opts;
            const n = Math.max(5, Math.min(1000, Number(count) || 100));
            const symbols = scope === 'all' ? SCAN_SYMBOLS : [this.symbol || this.options.symbol];
            const fresh = Date.now() - scan_cache.at < SCAN_TTL_MS && scan_cache.count >= n;
            if (!fresh) scan_cache = { at: Date.now(), count: n, data: {} };
            const todo = symbols.filter(sym => !scan_cache.data[sym]);
            for (let i = 0; i < todo.length; i += 4) {
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(
                    todo.slice(i, i + 4).map(async sym => {
                        try {
                            const res = await api_base.api.send({ ticks_history: sym, end: 'latest', count: n, style: 'ticks' });
                            const prices = res?.history?.prices ?? [];
                            const pip = Number.isFinite(Number(res?.pip_size)) ? Number(res.pip_size) : 2;
                            scan_cache.data[sym] = prices.map(p => getLastDigit(Number(p).toFixed(pip)));
                        } catch (e) {
                            scan_cache.data[sym] = [];
                        }
                    })
                );
            }
            const above = condition !== 'BELOW';
            let best = null;
            symbols.forEach(sym => {
                const digits = (scan_cache.data[sym] || []).slice(-n);
                if (!digits.length) return;
                const pct = digitPct(digits, kind, Number(digit));
                if (above ? pct < Number(threshold) : pct > Number(threshold)) return;
                if (!best || (above ? pct > best.pct : pct < best.pct)) best = { sym, pct };
            });
            const note_key = best ? best.sym : 'none';
            if (note_key !== this.last_scan_note || Date.now() - (this.last_scan_note_at || 0) > 30000) {
                this.last_scan_note = note_key;
                this.last_scan_note_at = Date.now();
                notify(
                    'info',
                    best
                        ? `Market scan (${symbols.length} market${symbols.length === 1 ? '' : 's'}, last ${n} ticks): best is ${best.sym} with ${kind} at ${best.pct.toFixed(1)}%.${best.sym !== (this.symbol || this.options.symbol) ? ' Moving there.' : ' Already on it.'}`
                        : `Market scan (${symbols.length} market${symbols.length === 1 ? '' : 's'}, last ${n} ticks): no market meets the condition yet. Waiting and scanning again.`
                );
            }
            if (!best) return '';
            if (best.sym !== (this.symbol || this.options.symbol)) await this.switchTrade({ symbol: best.sym });
            return best.sym;
        }

        /* Nexus: move to the next market in the list. */
        async rotateMarket() {
            const current = this.symbol || this.options.symbol;
            const next = SCAN_SYMBOLS[(SCAN_SYMBOLS.indexOf(current) + 1) % SCAN_SYMBOLS.length];
            await this.switchTrade({ symbol: next });
            return next;
        }

        checkTicksPromiseExists() {
            return this.$scope.ticksService.ticks_history_promise;
        }

        getTicks(toString = false) {
            return new Promise(resolve => {
                this.$scope.ticksService.request({ symbol: this.symbol }).then(ticks => {
                    const ticks_list = ticks.map(tick => {
                        if (toString) {
                            return tick.quote.toFixed(this.getPipSize());
                        }
                        return tick.quote;
                    });

                    resolve(ticks_list);
                });
            });
        }

        getLastTick(raw, toString = false) {
            return new Promise((resolve, reject) =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol })
                    .then(ticks => {
                        try {
                            let last_tick = raw ? getLast(ticks) : getLast(ticks).quote;
                            if (!raw && toString) {
                                last_tick = last_tick.toFixed(this.getPipSize());
                            }
                            resolve(last_tick);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .catch(e => {
                        if (e.code === 'MarketIsClosed') {
                            const localizedError = {
                                ...e,
                                message: getLocalizedErrorMessage(e.code, e.details),
                            };
                            globalObserver.emit('Error', localizedError);
                            resolve(e.code);
                        }
                    })
            );
        }

        getLastDigit() {
            return new Promise(resolve => this.getLastTick(false, true).then(tick => resolve(getLastDigit(tick))));
        }

        getLastDigitList() {
            return new Promise(resolve => this.getTicks().then(ticks => resolve(this.getLastDigitsFromList(ticks))));
        }
        getLastDigitsFromList(ticks) {
            const digits = ticks.map(tick => {
                return getLastDigit(tick.toFixed(this.getPipSize()));
            });
            return digits;
        }

        checkDirection(dir) {
            return new Promise(resolve =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol })
                    .then(ticks => resolve(getDirection(ticks) === dir))
            );
        }

        getOhlc(args) {
            const { granularity = this.options.candleInterval || 60, field } = args || {};

            return new Promise(resolve =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol, granularity })
                    .then(ohlc => resolve(field ? ohlc.map(o => o[field]) : ohlc))
            );
        }

        getOhlcFromEnd(args) {
            const { index: i = 1 } = args || {};

            const index = expectPositiveInteger(Number(i), localize('Index must be a positive integer'));

            return new Promise(resolve => this.getOhlc(args).then(ohlc => resolve(ohlc.slice(-index)[0])));
        }

        getPipSize() {
            return this.$scope.ticksService.pipSizes[this.symbol];
        }

        async requestAccumulatorStats() {
            const subscription_id = this.subscription_id_for_accumulators;
            const is_proposal_requested = this.is_proposal_requested_for_accumulators;
            const proposal_request = {
                ...window.Blockly.accumulators_request,
                amount: this?.tradeOptions?.amount,
                basis: this?.tradeOptions?.basis,
                contract_type: 'ACCU',
                currency: this?.tradeOptions?.currency,
                growth_rate: this?.tradeOptions?.growth_rate,
                proposal: 1,
                subscribe: 1,
                underlying_symbol: this?.tradeOptions?.symbol,
            };
            if (!subscription_id && !is_proposal_requested) {
                this.is_proposal_requested_for_accumulators = true;
                if (proposal_request) {
                    await api_base?.api?.send(proposal_request);
                }
            }
        }

        async handleOnMessageForAccumulators() {
            let ticks_stayed_in_list = [];
            return new Promise(resolve => {
                const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                    if (data.msg_type === 'proposal') {
                        try {
                            this.subscription_id_for_accumulators = data.subscription.id;
                            // this was done because we can multile arrays in the respone and the list comes in reverse order
                            const stat_list = (data.proposal.contract_details.ticks_stayed_in || []).flat().reverse();
                            ticks_stayed_in_list = [...stat_list, ...ticks_stayed_in_list];
                            if (ticks_stayed_in_list.length > 0) resolve(ticks_stayed_in_list);
                        } catch (error) {
                            globalObserver.emit('Unexpected message type or no proposal found:', error);
                        }
                    }
                });
                api_base.pushSubscription(subscription);
            });
        }

        async fetchStatsForAccumulators() {
            try {
                // request stats for accumulators
                const debouncedAccumulatorsRequest = debounce(() => this.requestAccumulatorStats(), 300);
                debouncedAccumulatorsRequest();
                // wait for proposal response
                const ticks_stayed_in_list = await this.handleOnMessageForAccumulators();
                return ticks_stayed_in_list;
            } catch (error) {
                globalObserver.emit('Error in subscription promise:', error);
                throw error;
            } finally {
                // forget all proposal subscriptions so we can fetch new stats data on new call
                await api_base?.api?.send({ forget_all: 'proposal' });
                this.is_proposal_requested_for_accumulators = false;
                this.subscription_id_for_accumulators = null;
            }
        }

        async getCurrentStat() {
            try {
                const ticks_stayed_in = await this.fetchStatsForAccumulators();
                return ticks_stayed_in?.[0];
            } catch (error) {
                globalObserver.emit('Error fetching current stat:', error);
            }
        }

        async getStatList() {
            try {
                const ticks_stayed_in = await this.fetchStatsForAccumulators();
                // we need to send only lastest 100 ticks
                return ticks_stayed_in?.slice(0, 100);
            } catch (error) {
                globalObserver.emit('Error fetching current stat:', error);
            }
        }

        async getDelayTickValue(tick_value) {
            return new Promise((resolve, reject) => {
                try {
                    const ticks = [];
                    const symbol = this.symbol;

                    const resolveAndExit = () => {
                        this.$scope.ticksService.stopMonitor({
                            symbol,
                            key: '',
                        });
                        resolve(ticks);
                        ticks.length = 0;
                    };

                    const watchTicks = tick_list => {
                        ticks.push(tick_list);
                        const current_tick = ticks.length;
                        if (current_tick === tick_value) {
                            resolveAndExit();
                        }
                    };

                    const delayExecution = tick_list => watchTicks(tick_list);

                    if (Number(tick_value) <= 0) resolveAndExit();
                    this.$scope.ticksService.monitor({ symbol, callback: delayExecution });
                } catch (error) {
                    reject(new Error(`Failed to start tick monitoring: ${error.message}`));
                }
            });
        }
    };
