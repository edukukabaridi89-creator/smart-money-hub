import { applyMiddleware, createStore } from 'redux';
import { thunk } from 'redux-thunk';
import { getLocalizedErrorMessage } from '@/constants/backend-error-messages';
import { createError } from '../../../utils/error';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { checkBlocksForProposalRequest, doUntilDone } from '../utils/helpers';
import { expectInitArg } from '../utils/sanitize';
import { speedState } from '@/nexus/speed';
import { proposalsReady, sell, start } from './state/actions';
import * as constants from './state/constants';
import rootReducer from './state/reducers';
import Balance from './Balance';
import OpenContract from './OpenContract';
import Proposal from './Proposal';
import Purchase from './Purchase';
import Sell from './Sell';
import Ticks from './Ticks';
import Total from './Total';


/* Resolves true after `n` fresh ticks, or false if the bot is stopped meanwhile. */
const waitTicks = (store, n) =>
    new Promise(resolve => {
        let seen = 0;
        let prev = store.getState().newTick;
        const unsubscribe = store.subscribe(() => {
            const { newTick, scope } = store.getState();
            if (scope === constants.STOP) {
                unsubscribe();
                return resolve(false);
            }
            if (newTick !== prev) {
                prev = newTick;
                if (++seen >= n) {
                    unsubscribe();
                    resolve(true);
                }
            }
        });
    });

const watchBefore = store =>
    watchScope({
        store,
        stopScope: constants.DURING_PURCHASE,
        passScope: constants.BEFORE_PURCHASE,
        passFlag: 'proposalsReady',
    });

const watchDuring = store =>
    watchScope({
        store,
        stopScope: constants.STOP,
        passScope: constants.DURING_PURCHASE,
        passFlag: 'openContract',
    });

/* The watchScope function is called randomly and resets the prevTick
 * which leads to the same problem we try to solve. So prevTick is isolated
 */
let prevTick;
const watchScope = ({ store, stopScope, passScope, passFlag }) => {
    // in case watch is called after stop is fired
    if (store.getState().scope === stopScope) {
        return Promise.resolve(false);
    }
    return new Promise(resolve => {
        const unsubscribe = store.subscribe(() => {
            const newState = store.getState();

            if (newState.newTick === prevTick) return;
            prevTick = newState.newTick;

            if (newState.scope === passScope && newState[passFlag]) {
                unsubscribe();
                resolve(true);
            }

            if (newState.scope === stopScope) {
                unsubscribe();
                resolve(false);
            }
        });
    });
};

export default class TradeEngine extends Balance(Purchase(Sell(OpenContract(Proposal(Ticks(Total(class {}))))))) {
    constructor($scope) {
        super();
        this.observer = $scope.observer;
        this.$scope = $scope;
        this.observe();
        this.data = {
            contract: {},
            proposals: [],
        };
        this.subscription_id_for_accumulators = null;
        this.is_proposal_requested_for_accumulators = false;
        this.store = createStore(rootReducer, applyMiddleware(thunk));
    }

    init(...args) {
        const [token, options] = expectInitArg(args);
        const { symbol } = options;

        this.initArgs = args;
        this.options = options;
        this.startPromise = this.loginAndGetBalance(token);

        if (!this.checkTicksPromiseExists()) this.watchTicks(symbol);
    }

    start(tradeOptions) {
        if (!this.options) {
            throw createError('NotInitialized', getLocalizedErrorMessage('NotInitialized'));
        }

        globalObserver.emit('bot.running');

        const validated_trade_options = this.validateTradeOptions(tradeOptions);

        this.tradeOptions = { ...validated_trade_options, symbol: this.options.symbol };
        this.store.dispatch(start());
        this.checkLimits(validated_trade_options);

        this.makeDirectPurchaseDecision();
    }

    /* Nexus: change what the NEXT trades use, while the bot runs. Any field left out is unchanged.
     *   symbol     - market (e.g. 'R_50'); ticks and entry analysis follow it
     *   prediction - digit for Over/Under/Matches/Differs; null clears it (Even/Odd and Rise/Fall take none)
     *   duration   - ticks
     * Contract type itself is chosen per purchase (Bot.purchase('DIGITEVEN')), so a bot can start with Over and
     * recover with Even/Odd. Works for direct purchases (no Payout / Ask price blocks). */
    async switchTrade(change = {}) {
        if (!this.tradeOptions) {
            throw createError('NotInitialized', getLocalizedErrorMessage('NotInitialized'));
        }
        const { symbol, prediction, duration } = change;
        if (symbol) {
            this.options.symbol = symbol;
            this.tradeOptions.symbol = symbol;
            await this.switchSymbol(symbol);
        }
        if (prediction === null) {
            delete this.tradeOptions.prediction;
        } else if (prediction !== undefined) {
            this.tradeOptions.prediction = Number(prediction);
        }
        if (duration !== undefined) {
            this.tradeOptions.duration = Number(duration);
        }
    }

    loginAndGetBalance(token) {
        if (this.token === token) {
            return Promise.resolve();
        }
        // for strategies using total runs, GetTotalRuns function is trying to get loginid and it gets called before Proposals calls.
        // the below required loginid to be set in Proposal calls where loginAndGetBalance gets resolved.
        // Earlier this used to happen as soon as we get ticks_history response and by the time GetTotalRuns gets called we have required info.
        this.accountInfo = api_base.account_info;
        this.token = api_base.token;
        return new Promise(resolve => {
            // Try to recover from a situation where API doesn't give us a correct response on
            // "proposal_open_contract" which would make the bot run forever. When there's a "sell"
            // event, wait a couple seconds for the API to give us the correct "proposal_open_contract"
            // response, if there's none after x seconds. Send an explicit request, which _should_
            // solve the issue. This is a backup!
            const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                if (data.msg_type === 'transaction' && data.transaction.action === 'sell') {
                    this.transaction_recovery_timeout = setTimeout(() => {
                        const { contract } = this.data;
                        const is_same_contract = contract.contract_id === data.transaction.contract_id;
                        const is_open_contract = contract.status === 'open';
                        if (is_same_contract && is_open_contract) {
                            doUntilDone(() => {
                                api_base.api.send({ proposal_open_contract: 1, contract_id: contract.contract_id });
                            }, ['PriceMoved']);
                        }
                    }, 1500);
                }
                resolve();
            });
            api_base.pushSubscription(subscription);
        });
    }

    observe() {
        this.observeOpenContract();
        this.observeBalance();
        this.observeProposals();
    }

    /* Global Execution Speed Mode (see src/nexus/speed.ts), read live on every call:
     *  NORMAL    - untouched: wait for settlement before the next trade.
     *  SKIP_TICK - after a trade completes, skip exactly 1 tick before evaluating the next entry.
     *  TURBO     - do not wait for settlement: release the single-contract lock right after the buy so the
     *              next trade fires on the very next tick. Settlement is tracked in the background
     *              (logged + totals), but after-purchase blocks cannot see the result of an in-flight trade. */
    watch(watchName) {
        const mode = speedState.mode;
        if (watchName === 'before') {
            return watchBefore(this.store).then(async is_ready => {
                const should_skip = this.skip_tick_pending && mode === 'SKIP_TICK';
                this.skip_tick_pending = false;
                return is_ready && should_skip ? waitTicks(this.store, 1) : is_ready;
            });
        }
        if (mode === 'TURBO' && this.contractId) {
            this.turbo_contracts = this.turbo_contracts || new Set();
            this.turbo_contracts.add(this.contractId);
            // make sure updates for the released contract keep streaming (a duplicate-subscribe error is harmless)
            Promise.resolve(api_base.api.send({ proposal_open_contract: 1, contract_id: this.contractId, subscribe: 1 })).catch(() => {});
            this.contractId = '';
            this.store.dispatch(sell()); // scope -> STOP, so after_purchase + trade_again run immediately
            return Promise.resolve(false);
        }
        return watchDuring(this.store).then(is_open => {
            if (!is_open) this.skip_tick_pending = true;
            return is_open;
        });
    }

    makeDirectPurchaseDecision() {
        const { has_payout_block, is_basis_payout } = checkBlocksForProposalRequest();
        this.is_proposal_subscription_required = has_payout_block || is_basis_payout;

        if (this.is_proposal_subscription_required) {
            this.makeProposals({ ...this.options, ...this.tradeOptions });
            this.checkProposalReady();
        } else {
            this.store.dispatch(proposalsReady());
        }
    }
}
