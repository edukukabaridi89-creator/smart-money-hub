// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { SYMBOLS, symbolName } from '@/nexus/config';
import { openXmlInBotBuilder } from '@/nexus/open-bot';
import { baselineOf, suggest } from '@/nexus/signals';
import { planFor, specFor, MULTIPLIER } from '@/nexus/risk-plan';
import { buildBotXml } from '@/nexus/studio/templates';
import { hub } from '@/nexus/ticks-hub';
import { Panel, useHub } from '@/nexus/ui';
import { useStore } from '@/hooks/useStore';

const IDS = SYMBOLS.map(m => m.id);
const money = (n: number, c: string) => `${n.toFixed(2)} ${c}`;

export const RiskCalculator = observer(() => {
    const { client } = useStore();
    const cur = client?.currency || 'USD';
    const [capital, setCapital] = useState('');
    const [scanning, setScanning] = useState(false);
    const [best, setBest] = useState(null);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(false);
    const t0 = useRef(0);
    const plan = useMemo(() => planFor(parseFloat(capital)), [capital]);

    useHub(scanning ? IDS : []); // market data is only requested when you press the search button

    useEffect(() => {
        if (!scanning) return;
        const t = setInterval(() => {
            const rows = SYMBOLS.filter(m => !hub.isUnavailable(m.id)).map(m => suggest(m.id)).filter(Boolean);
            const waited = Date.now() - t0.current;
            if (rows.length >= 4 && (rows.length >= SYMBOLS.length - 3 || waited > 12000) || waited > 25000) {
                clearInterval(t);
                setScanning(false);
                if (!rows.length) return setMsg('Could not load market data. Check your connection and try again.');
                setBest([...rows].sort((a, b) => b.z - a.z)[0]);
                setMsg('');
            }
        }, 500);
        return () => clearInterval(t);
    }, [scanning]);

    const search = () => {
        setBest(null);
        setMsg('');
        t0.current = Date.now();
        setScanning(true);
    };
    const load = async () => {
        setLoading(true);
        try {
            const spec = specFor(plan, best);
            await openXmlInBotBuilder(await buildBotXml(spec), spec.name);
        } catch (e) {
            setMsg(`Could not load the bot: ${String(e?.message || e)}`);
        }
        setLoading(false);
    };

    return (
        <div className='nx-rc'>
            <Panel className='nx-rc__card'>
                <h3>Risk calculator</h3>
                <label className='nx-rc__label' htmlFor='nx-rc-cap'>How much capital do you have? ({cur})</label>
                <input id='nx-rc-cap' className='nx-input' type='number' inputMode='decimal' min='0' step='any' placeholder='e.g. 100' value={capital} onChange={e => setCapital(e.target.value)} />
                {capital !== '' && !plan.valid && <p className='down'>Stake would be below Deriv's minimum. You need at least {money(plan.minCapital, cur)} of capital.</p>}
                {plan.valid && (
                    <>
                        <div className='nx-rc__big'>
                            <span>Stake to use (10% of capital)</span>
                            <b>{money(plan.stake, cur)}</b>
                        </div>
                        <p className='nx-muted'>With a ×{MULTIPLIER} martingale (stake doubles after each loss), a losing streak costs:</p>
                        <table className='nx-rc__table'>
                            <thead><tr><th>Loss in a row</th><th>Next stake</th><th>Total lost</th></tr></thead>
                            <tbody>
                                {plan.steps.slice(0, Math.min(plan.steps.length, plan.survivable + 1)).map(s => (
                                    <tr key={s.n} className={s.affordable ? '' : 'is-over'}>
                                        <td>{s.n}</td><td>{money(s.stake, cur)}</td><td>{money(s.lost, cur)}{s.affordable ? '' : ' (more than your capital)'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className='nx-muted'>Your capital covers {plan.survivable} losing trade{plan.survivable === 1 ? '' : 's'} in a row. This plan caps the stake at {money(plan.maxStake, cur)}, then goes back to {money(plan.stake, cur)}. No setting guarantees a profit: a longer losing streak than this can lose most of your capital.</p>
                    </>
                )}
            </Panel>

            <Panel className='nx-rc__card'>
                <h3>Best market and settings</h3>
                <p className='nx-muted'>Scans every volatility market for the trade type whose winning digits stand out most in the last 1,000 ticks, then picks an entry digit for you.</p>
                <button className='nx-btn nx-btn--go' disabled={!plan.valid || scanning} onClick={search}>{scanning ? 'Searching markets…' : best ? 'Search again' : 'Search best market and settings'}</button>
                {!plan.valid && <p className='nx-muted'>Enter your capital first.</p>}
                {msg && <p className='down'>{msg}</p>}
                {best && plan.valid && (
                    <div className='nx-rc__result'>
                        <div className='nx-rc__pick'><span>Best market now</span><b>{symbolName(best.symbol)}</b></div>
                        <ul>
                            <li><span>Trade type</span><b>{best.label}</b></li>
                            <li><span>Entry</span><b>Buy when the last digit is {best.trigger}</b></li>
                            <li><span>Stake</span><b>{money(plan.stake, cur)}, 1 tick</b></li>
                            <li><span>After a loss</span><b>Stake ×{MULTIPLIER}, up to {money(plan.maxStake, cur)}</b></li>
                            <li><span>Take profit</span><b>{money(plan.takeProfit, cur)}</b></li>
                            <li><span>Stop loss</span><b>{money(plan.stopLoss, cur)}</b></li>
                        </ul>
                        <p className='nx-muted'>
                            In the last {best.samples ? '1,000' : ''} ticks this type won about {baselineOf(best.type, best.barrier) + best.edge > 0 ? (baselineOf(best.type, best.barrier) + best.edge).toFixed(1) : '0'}% of the time (normal is {baselineOf(best.type, best.barrier)}%){best.rate > 0 ? `, and ${best.rate.toFixed(0)}% on the tick after the digit ${best.trigger} (${best.samples} times)` : ''}. That describes the past, it does not promise the next trades.
                        </p>
                        <button className='nx-btn nx-btn--go' disabled={loading} onClick={load}>{loading ? 'Loading…' : 'Load in Bot Builder'}</button>
                        <p className='nx-muted'>The bot opens in Bot Builder with these settings. You can review and change them before you press Run. Try it on a demo account first.</p>
                    </div>
                )}
            </Panel>
        </div>
    );
});
