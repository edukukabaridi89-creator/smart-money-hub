// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { startRunner } from './gate';
import { nexus } from './store';

/** Auto-repeat toggle: re-fires `fire` on live ticks, paced by the global Execution Speed Mode. */
export const useRepeat = (fire: () => Promise<unknown>) => {
    const [on, setOn] = useState(false);
    const f = useRef(fire);
    f.current = fire;
    useEffect(() => (on ? startRunner(() => nexus.symbol, () => f.current()) : undefined), [on]);
    return (
        <button className={`nx-btn ${on ? 'nx-btn--stop' : ''}`} onClick={() => setOn(!on)}>
            {on ? 'STOP AUTO-REPEAT' : 'AUTO-REPEAT (speed mode)'}
        </button>
    );
};
