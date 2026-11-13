// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { nexus } from '@/nexus/store';
import { runTrade } from '@/nexus/run-trade';
import { useRepeat } from '@/nexus/use-repeat';
import { DigitCircles, Field, Num, Panel, SymbolSelect, TickChart } from '@/nexus/ui';

const TYPES = [
    ['DIGITEVEN', 'Even', 0], ['DIGITODD', 'Odd', 0], ['DIGITOVER', 'Over', 1], ['DIGITUNDER', 'Under', 1],
    ['DIGITMATCH', 'Matches', 1], ['DIGITDIFF', 'Differs', 1], ['CALL', 'Rise', 0], ['PUT', 'Fall', 0],
];
export const BulkTrader = observer(() => {
    const [type, setType] = useState('DIGITOVER');
    const [stake, setStake] = useState(1);
    const [barrier, setBarrier] = useState(3);
    const [runs, setRuns] = useState(5);
    const needs = TYPES.find(t => t[0] === type)[2];
    const go = () => Promise.all(Array.from({ length: Math.min(50, Math.max(1, Math.floor(runs))) }, () => runTrade({ symbol: nexus.symbol, contract_type: type, stake, barrier: needs ? barrier : undefined, source: 'bulk' })));
    const repeat = useRepeat(go);
    return (
        <div className='nx-split'>
            <Panel title='Bulk Trader'>
                <Field label='Volatility index'><SymbolSelect /></Field>
                <Field label='Trade type'>
                    <select className='nx-input' value={type} onChange={e => setType(e.target.value)}>{TYPES.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>
                </Field>
                {!!needs && <Field label='Barrier'><Num int min={type === 'DIGITOVER' ? 0 : type === 'DIGITUNDER' ? 1 : 0} max={type === 'DIGITOVER' ? 8 : 9} value={barrier} onChange={setBarrier} /></Field>}
                <Field label='Stake per execution'><Num min={0.35} step={0.1} value={stake} onChange={setStake} /></Field>
                <Field label='Number of runs at once'><Num int min={1} max={50} value={runs} onChange={setRuns} /></Field>
                <button className='nx-btn nx-btn--go' onClick={go}>EXECUTE ×{runs}</button>
                {repeat}
            </Panel>
            <Panel title='Digit circles'><DigitCircles /><TickChart /></Panel>
        </div>
    );
});
