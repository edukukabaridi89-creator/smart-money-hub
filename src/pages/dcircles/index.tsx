// @ts-nocheck
import React from 'react';
import { DigitCircles, Field, Panel, SymbolSelect, TickChart } from '@/nexus/ui';

export const DCircles = () => (
    <Panel title='Digit Analysis · last 1,000 ticks'>
        <Field label='Volatility index'><SymbolSelect /></Field>
        <DigitCircles />
        <TickChart />
    </Panel>
);
