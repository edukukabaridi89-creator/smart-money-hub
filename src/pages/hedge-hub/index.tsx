// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { nexus } from '@/nexus/store';
import { runTrade } from '@/nexus/run-trade';
import { useRepeat } from '@/nexus/use-repeat';
import { DigitCircles, Field, Num, Panel, SymbolSelect, TickChart } from '@/nexus/ui';

export const HedgeHub = observer(() => {
    const [stake, setStake] = useState(1);
    const [under, setUnder] = useState(4);
    const [over, setOver] = useState(5);
    const hedge = () => {
        const base = { symbol: nexus.symbol, stake, source: 'hedge' };
        // both sends leave synchronously in the same tick
        return Promise.all([runTrade({ ...base, contract_type: 'DIGITUNDER', barrier: under }), runTrade({ ...base, contract_type: 'DIGITOVER', barrier: over })]);
    };
    const repeat = useRepeat(hedge);
    return (
        <div className='nx-split'>
            <Panel title='Hedge Hub'>
                <Field label='Volatility index'><SymbolSelect /></Field>
                <Field label='Stake (per leg)'><Num min={0.35} step={0.1} value={stake} onChange={setStake} /></Field>
                <div className='nx-row'>
                    <Field label='Under'><Num int min={1} max={9} value={under} onChange={setUnder} /></Field>
                    <Field label='Over'><Num int min={0} max={8} value={over} onChange={setOver} /></Field>
                </div>
                <button className='nx-btn nx-btn--hedge' onClick={hedge}>HEDGE NOW</button>
                {repeat}
            </Panel>
            <Panel title='Digit circles'><DigitCircles /><TickChart /></Panel>
        </div>
    );
});
