// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { buyParameters } from '@/nexus/buy-params';
import { SYMBOLS } from '@/nexus/config';
import { dispatch } from '@/nexus/dispatcher';
import { getAvailable } from '@/nexus/dtrader/market-data';
import { availableTypes, defaultForm, requestFor, typeById, UNIT_LABEL, validate, type Form, type TradeSide, type TradeTypeDef } from '@/nexus/dtrader/trade-types';
import { positions, sellPosition } from '@/nexus/positions';
import { nexus } from '@/nexus/store';
import { DigitCircles } from '@/nexus/ui';
import ChartWrapper from '../chart/chart-wrapper';
import { Check, Stepper, useQuote } from './fields';
import { SideGlyph, TypeIcon } from './icons';
import { TypeMenu } from './type-menu';
import './trader.scss';

const rangeOf = (available: any[] | null, contract_type: string, key: string, fallback: any[]) => {
    const v = available?.find(c => c.contract_type === contract_type)?.[key];
    return Array.isArray(v) && v.length ? v : fallback;
};

/** One buy button. No payout or return figures are shown: they depend on the commission/markup the site owner sets
 * on their Deriv app ID. The price paid appears in Summary / Transactions / Journal once the trade is placed.
 * The live quote is only used to validate the trade and show Deriv's own error text. */
const BuyButton = ({ def, side, form, symbol, currency, onBuy }: { def: TradeTypeDef; side: TradeSide; form: Form; symbol: string; currency: string; onBuy: (s: TradeSide) => void }) => {
    const invalid = validate(def, form);
    const params = invalid || !symbol ? null : buyParameters(requestFor(def, side, form, symbol), currency);
    const { q } = useQuote(params, JSON.stringify(params));
    return (
        <div className='dt-quote'>
            <button className={`dt-buy dt-buy--${side.tone}`} disabled={!!invalid || !symbol || (q && !q.ok)} onClick={() => onBuy(side)}>
                <span className='dt-buy__label'><SideGlyph id={def.id} tone={side.tone} />{side.label}</span>
            </button>
            {invalid ? <div className='dt-quote__err'>{invalid}</div> : q && !q.ok ? <div className='dt-quote__err'>{q.error}</div> : null}
        </div>
    );
};

export const ManualTrader = observer(() => {
    const { chart_store, client } = useStore();
    const symbol = chart_store.symbol;
    const currency = client.currency || 'USD';
    const [typeId, setTypeId] = useState('evenodd');
    const [forms, setForms] = useState<Record<string, Form>>({});
    const [menu, setMenu] = useState(false);
    const [available, setAvailable] = useState<any[] | null>(null);
    const [lock, setLock] = useState(false);

    const types = useMemo(() => availableTypes(available), [available]);
    const def = typeById(typeId);
    const form: Form = forms[typeId] ?? defaultForm(def);
    const patch = (p: Partial<Form>) => setForms(s => ({ ...s, [typeId]: { ...(s[typeId] ?? defaultForm(def)), ...p } }));

    // what the broker offers on the chosen market
    useEffect(() => {
        if (!symbol) return;
        let live = true;
        setAvailable(null);
        getAvailable(symbol).then(l => live && setAvailable(l.length ? l : null));
        return () => { live = false; };
    }, [symbol]);
    useEffect(() => { if (types.length && !types.some(t => t.id === typeId)) setTypeId(types[0].id); }, [types]);
    // keep DCircles / Hedge / Bot Builder on the same volatility market as the chart
    useEffect(() => { if (symbol && SYMBOLS.some(s => s.id === symbol)) nexus.setSymbol(symbol); }, [symbol]);
    useEffect(() => { if (nexus.symbol && chart_store.symbol !== nexus.symbol) chart_store.onSymbolChange(nexus.symbol); }, []);

    const multipliers = rangeOf(available, 'MULTUP', 'multiplier_range', [10, 20, 30, 40, 50]);
    const growthRates = rangeOf(available, 'ACCU', 'growth_rate_range', [0.01, 0.02, 0.03, 0.04, 0.05]);
    const cancelOptions = rangeOf(available, 'MULTUP', 'cancellation_range', ['5m', '10m', '15m', '30m', '60m']);
    useEffect(() => { if (def.id === 'multipliers' && !multipliers.includes(form.multiplier)) patch({ multiplier: multipliers[Math.floor(multipliers.length / 2)] }); }, [multipliers.join(), typeId]);
    useEffect(() => { if (def.id === 'accumulators' && !growthRates.includes(form.growth)) patch({ growth: growthRates[Math.min(2, growthRates.length - 1)] }); }, [growthRates.join(), typeId]);

    const onBuy = (side: TradeSide) => {
        if (!client.is_logged_in) return nexus.log('Log in to place trades.');
        if (lock) return;
        setLock(true);
        setTimeout(() => setLock(false), 700);
        dispatch({ ...requestFor(def, side, form, symbol), source: 'manual' }).then(r => r.error && nexus.log(r.error)); // lands in Summary / Transactions / Journal
    };

    const has = (f: string) => def.fields.includes(f as any);
    const unitOptions = def.units ?? ['t'];
    return (
        <>
            <div className='dt__chart'>
                <ChartWrapper show_digits_stats={def.id === 'accumulators'} />
                {def.group === 'Digits' && symbol && <div className='dt__strip'><DigitCircles symbol={symbol} small /></div>}
            </div>
            <aside className='dt__side'>
                <details className='dt-learn'><summary>Learn about this trade type</summary><p>{def.about}</p></details>
                <button className='dt-type' onClick={() => setMenu(true)} aria-haspopup='dialog'><TypeIcon id={def.id} /><span>{def.label}</span><i aria-hidden='true'>⌄</i></button>
                {menu && <TypeMenu types={types} current={typeId} onPick={setTypeId} onClose={() => setMenu(false)} />}

                {has('growth') && (
                    <div className='dt-card'>
                        <h6>Growth rate</h6>
                        <div className='dt-chips'>{growthRates.map((g: number) => <button key={g} className={g === form.growth ? 'on' : ''} onClick={() => patch({ growth: g })}>{Math.round(g * 100)}%</button>)}</div>
                    </div>
                )}
                {has('multiplier') && (
                    <div className='dt-card'>
                        <h6>Multiplier</h6>
                        <select value={form.multiplier} onChange={e => patch({ multiplier: Number(e.target.value) })}>{multipliers.map((m: number) => <option key={m} value={m}>x{m}</option>)}</select>
                    </div>
                )}
                {has('ticks') && (
                    <div className='dt-card'>
                        <h6>Ticks</h6>
                        <input type='range' min={1} max={10} step={1} value={form.ticks} onChange={e => patch({ ticks: Number(e.target.value) })} aria-label='Ticks' />
                        <div className='dt-card__value'>{form.ticks} Tick{form.ticks === 1 ? '' : 's'}</div>
                    </div>
                )}
                {has('duration') && (
                    <div className='dt-card'>
                        <h6>Duration</h6>
                        <div className='dt-duration'>
                            <select value={form.durationUnit} onChange={e => patch({ durationUnit: e.target.value as any })}>{unitOptions.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}</select>
                            <Stepper value={form.durationValue} min={1} integer onChange={(n: number) => patch({ durationValue: n })} />
                        </div>
                    </div>
                )}
                {has('prediction') && (
                    <div className='dt-card'>
                        <h6>Last Digit Prediction</h6>
                        <div className='dt-digits'>{Array.from({ length: 10 }, (_, d) => <button key={d} className={d === form.digit ? 'on' : ''} onClick={() => patch({ digit: d })}>{d}</button>)}</div>
                    </div>
                )}
                {has('barrier') && (
                    <div className='dt-card'>
                        <h6>{def.id === 'vanillas' ? 'Strike price' : 'Barrier offset'}</h6>
                        <input className='dt-text' value={form.barrier} onChange={e => patch({ barrier: e.target.value })} placeholder='+0.50' aria-label='Barrier' />
                    </div>
                )}

                <div className='dt-card'>
                    {has('basis') ? (
                        <div className='dt-toggle' role='group' aria-label='Stake or payout'>
                            <button className={form.basis === 'stake' ? 'on' : ''} onClick={() => patch({ basis: 'stake' })}>Stake</button>
                            <button className={form.basis === 'payout' ? 'on' : ''} onClick={() => patch({ basis: 'payout' })}>Payout</button>
                        </div>
                    ) : <h6>Stake</h6>}
                    <Stepper value={form.amount} min={0.35} suffix={currency} onChange={(n: number) => patch({ amount: n })} />
                </div>

                {has('takeProfit') && (
                    <Check on={form.takeProfit.on} onChange={(on: boolean) => patch({ takeProfit: { ...form.takeProfit, on } })} label='Take profit'>
                        <Stepper value={form.takeProfit.amount} min={0.01} suffix={currency} onChange={(n: number) => patch({ takeProfit: { ...form.takeProfit, amount: n } })} />
                    </Check>
                )}
                {has('stopLoss') && (
                    <Check on={form.stopLoss.on} onChange={(on: boolean) => patch({ stopLoss: { ...form.stopLoss, on } })} label='Stop loss'>
                        <Stepper value={form.stopLoss.amount} min={0.01} suffix={currency} onChange={(n: number) => patch({ stopLoss: { ...form.stopLoss, amount: n } })} />
                    </Check>
                )}
                {has('dealCancel') && (
                    <Check on={form.dealCancel.on} onChange={(on: boolean) => patch({ dealCancel: { ...form.dealCancel, on } })} label='Deal cancellation'>
                        <select value={form.dealCancel.option} onChange={e => patch({ dealCancel: { ...form.dealCancel, option: e.target.value } })}>{cancelOptions.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
                    </Check>
                )}

                <div className='dt-buys'>
                    {def.sides.map(s => <BuyButton key={s.contract_type} def={def} side={s} form={form} symbol={symbol} currency={currency} onBuy={onBuy} />)}
                </div>
                {!client.is_logged_in && <p className='dt-note'>Log in to place trades. Prices are live.</p>}

                {positions.list.length > 0 && (
                    <div className='dt-pos'>
                        <h6>Open positions</h6>
                        {positions.list.map(p => (
                            <div key={p.id} className={`dt-pos__row ${p.closed ? (p.profit >= 0 ? 'win' : 'loss') : ''}`}>
                                <span>{p.type}<small>{p.symbol}</small></span>
                                <span>{p.buyPrice.toFixed(2)}</span>
                                <span className={p.profit >= 0 ? 'up' : 'down'}>{p.profit >= 0 ? '+' : ''}{p.profit.toFixed(2)}</span>
                                {p.sellable ? <button onClick={() => sellPosition(p.id)}>Close</button> : <em>{p.closed ? 'Closed' : 'Open'}</em>}
                            </div>
                        ))}
                    </div>
                )}
            </aside>
        </>
    );
});
