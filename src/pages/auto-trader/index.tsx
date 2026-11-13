// @ts-nocheck
import React from 'react';
import { observer } from 'mobx-react-lite';
import { auto, needsBarrier, nextStake, resetScan, runNow, scanMarkets, startAi } from '@/nexus/auto-engine';
import { symbolName } from '@/nexus/config';
import { nexus } from '@/nexus/store';
import { DigitCircles, Field, Num, Panel } from '@/nexus/ui';

const TYPES = { DIGITEVEN: 'Even', DIGITODD: 'Odd', DIGITOVER: 'Over', DIGITUNDER: 'Under' };
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const Banner = observer(() => {
    const sc = auto.scan;
    const left = sc ? Math.max(0, auto.ttl - (auto.now - sc.takenAt) / 1000) : 0;
    const label = TYPES[auto.type] + (needsBarrier() ? ` ${auto.barrier}` : '');
    let cls = 'idle', text = `No scan yet. Click Scan Markets to find the best volatility for ${label}.`;
    if (sc?.expired === 'time') (cls = 'expired'), (text = 'Scan expired — new scan needed.');
    else if (sc?.expired === 'drift') (cls = 'expired'), (text = "Strategy expired — the market's digit pattern changed. New scan needed.");
    else if (sc && auto.signal) (cls = 'signal'), (text = auto.ai && nexus.autoOn ? `Cursor is on ${sc.trigger} — AI is entering ${label} now.` : `ENTRY SIGNAL — the cursor is on ${sc.trigger}. Run ${label} now!`);
    else if (sc) (cls = 'ready'), (text = `${symbolName(sc.symbol)} · wait for the cursor to land on ${sc.trigger}${auto.ai && nexus.autoOn ? ' — AI is waiting.' : '.'}  Valid for ${mmss(left)}`);
    return <div className={`nx-banner nx-banner--${cls}`}>{text}</div>;
});

export const AutoTraderPage = observer(() => {
    const sc = auto.scan;
    const valid = sc && !sc.expired;
    return (
        <div className='nx-split'>
            <Panel title='Auto Trader'>
                <Field label='Trade type'>
                    <select className='nx-input' value={auto.type} onChange={e => ((auto.type = e.target.value), resetScan())}>
                        {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </Field>
                {needsBarrier() && <Field label='Barrier digit'><Num int min={auto.type === 'DIGITUNDER' ? 1 : 0} max={auto.type === 'DIGITUNDER' ? 9 : 8} value={auto.barrier} onChange={v => ((auto.barrier = v), resetScan())} /></Field>}
                <Field label='Stake'><Num min={0.35} step={0.1} value={auto.stake} onChange={v => (auto.stake = v)} /></Field>

                <label className='nx-check'>
                    <input type='checkbox' checked={auto.ai} onChange={e => ((auto.ai = e.target.checked), (nexus.autoOn = false))} />
                    <span>Let AI find the entry point and run<small>{auto.ai ? 'AI trades when the cursor lands on the entry digit.' : "You trade yourself when the entry signal appears."}</small></span>
                </label>

                <label className='nx-check'>
                    <input type='checkbox' checked={auto.mg.on} onChange={e => (auto.mg.on = e.target.checked)} />
                    <span>Martingale on loss<small>Multiply the stake after each loss, reset after a win.</small></span>
                </label>
                {auto.mg.on && (
                    <div className='nx-row'>
                        <Field label='Multiplier'><Num min={1.1} step={0.1} value={auto.mg.mult} onChange={v => (auto.mg.mult = v)} /></Field>
                        <Field label='Max steps'><Num int min={1} max={10} value={auto.mg.max} onChange={v => (auto.mg.max = v)} /></Field>
                    </div>
                )}

                <Field label='Scan valid for'>
                    <select className='nx-input' value={auto.ttl} onChange={e => (auto.ttl = Number(e.target.value))}>
                        <option value={60}>1 minute</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option>
                    </select>
                </Field>
                <label className='nx-check'>
                    <input type='checkbox' checked={auto.rescan} onChange={e => (auto.rescan = e.target.checked)} />
                    <span>Re-scan automatically when expired</span>
                </label>

                <button className='nx-btn nx-btn--go' onClick={scanMarkets}>SCAN MARKETS</button>
                {auto.ai ? (
                    <button className={`nx-btn ${nexus.autoOn ? 'nx-btn--stop' : 'nx-btn--hedge'}`} disabled={!valid && !nexus.autoOn} onClick={() => (nexus.autoOn ? (nexus.autoOn = false) : startAi())}>
                        {nexus.autoOn ? 'STOP AI' : 'START AI'}
                    </button>
                ) : (
                    <button className={`nx-btn nx-btn--hedge ${valid && auto.signal ? 'nx-glow' : ''}`} disabled={!valid} onClick={runNow}>RUN NOW · {TYPES[auto.type]} · ${nextStake()}</button>
                )}
            </Panel>

            <div className='nx-stack'>
                <Banner />
                <Panel title={sc ? `Scanned market: ${symbolName(sc.symbol)}` : 'Scanned market'}>
                    <DigitCircles symbol={sc?.symbol ?? nexus.symbol} trigger={valid ? sc.trigger : null} />
                    {sc && (
                        <div className='nx-rank'>
                            <span className='nx-muted'>Best markets for {TYPES[auto.type]}:</span>
                            {sc.ranking.map(r => <span key={r.id} className={r.id === sc.symbol ? 'on' : ''}>{symbolName(r.id)} <b>{r.edge >= 0 ? '+' : ''}{r.edge.toFixed(1)}%</b></span>)}
                        </div>
                    )}
                    {sc && <div className='nx-muted'>Entry digit {sc.trigger}: the trade won {sc.rate.toFixed(0)}% of the {sc.samples} times the cursor landed on it in the last 1,000 ticks. Past digit frequencies don't guarantee the next result.</div>}
                </Panel>
                <Panel title='Session'>
                    <div className='nx-dstats'>
                        <span>Wins <b>{auto.wins}</b></span>
                        <span>Losses <b>{auto.lost}</b></span>
                        <span>P/L <b className={auto.pnl >= 0 ? 'up' : 'down'}>{auto.pnl.toFixed(2)}</b></span>
                        <span>Next stake <b>{nextStake()}</b>{auto.mg.on && auto.losses > 0 ? ` (step ${Math.min(auto.losses, auto.mg.max)})` : ''}</span>
                        <span>Last <b>{auto.last || '—'}</b></span>
                    </div>
                </Panel>
            </div>
        </div>
    );
});
