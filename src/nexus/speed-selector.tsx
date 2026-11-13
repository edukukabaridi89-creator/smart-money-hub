// @ts-nocheck
import React from 'react';
import { observer } from 'mobx-react-lite';
import { SPEED_MODES } from './speed';
import { nexus } from './store';
import './speed-selector.scss';

/** Sits next to the account balance in the header. Desktop: 3 buttons. `compact` (mobile): a small dropdown. */
export const SpeedSelector = observer(({ compact = false }: { compact?: boolean }) =>
    compact ? (
        <select className='nx-speed nx-speed--compact' aria-label='Execution speed' value={nexus.executionSpeedMode} onChange={e => nexus.setSpeed(e.target.value)}>
            {SPEED_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
    ) : (
        <div className='nx-speed' role='radiogroup' aria-label='Execution speed'>
            {SPEED_MODES.map(m => (
                <button key={m.id} role='radio' aria-checked={nexus.executionSpeedMode === m.id} title={m.hint} className={nexus.executionSpeedMode === m.id ? 'on' : ''} onClick={() => nexus.setSpeed(m.id)}>
                    {m.label}
                </button>
            ))}
        </div>
    )
);
