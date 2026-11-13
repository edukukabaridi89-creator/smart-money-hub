// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import ApiHelpers from '@/external/bot-skeleton/services/api/api-helpers';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { SYMBOLS } from './config';
import { nexus } from './store';
import { DigitCircles, SymbolSelect } from './ui';

export const miniCircles = observable({ open: false });
export const toggleMiniCircles = () => runInAction(() => (miniCircles.open = !miniCircles.open));

const ids = SYMBOLS.map(s => s.id);
const blockOf = () => window.Blockly?.derivWorkspace?.getBlocksByType?.('trade_definition_market', false)?.[0];
export const builderSymbol = (): string => {
    try { return blockOf()?.getFieldValue('SYMBOL_LIST') || ''; } catch (e) { return ''; }
};
/** Moves the Bot Builder's Market block to `sym` (picks the matching sub-market first, as the dropdowns do). */
export const setBuilderSymbol = (sym: string): boolean => {
    try {
        const b = blockOf();
        const as = ApiHelpers?.instance?.active_symbols;
        if (!b || !as) return false;
        const market = b.getFieldValue('MARKET_LIST');
        for (const [, sub] of as.getSubmarketDropdownOptions(market) || []) {
            if ((as.getSymbolDropdownOptions(sub) || []).some(([, v]) => v === sym)) {
                if (b.getFieldValue('SUBMARKET_LIST') !== sub) b.setFieldValue(sub, 'SUBMARKET_LIST');
                b.setFieldValue(sym, 'SYMBOL_LIST');
                return b.getFieldValue('SYMBOL_LIST') === sym;
            }
        }
    } catch (e) {}
    return false;
};

/** Toolbar icon that replaces the Save button. */
export const MiniCirclesButton = observer(() => (
    <span id='db-toolbar__circles-button' className={`toolbar__icon nx-mc-btn ${miniCircles.open ? 'is-on' : ''}`} onClick={toggleMiniCircles} role='button' aria-label='Digit circles' aria-pressed={miniCircles.open}>
        <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden='true'>
            {[5, 12, 19].map(x => [6, 13].map(y => <circle key={`${x}${y}`} cx={x} cy={y} r='2.6' />))}
            <path d='M4 20h16' strokeLinecap='round' />
            <path d='M12 17.4v2.4' strokeLinecap='round' />
        </svg>
    </span>
));

/** Small floating digit-circles panel for the Bot Builder. Drag it by its title; the page under it (including Run) stays clickable. */
export const MiniCirclesPanel = observer(() => {
    const { dashboard } = useStore();
    const here = dashboard.active_tab === DBOT_TABS.BOT_BUILDER;
    const open = miniCircles.open && here;
    const mobile = window.innerWidth <= 700;
    const W = mobile ? Math.min(window.innerWidth - 16, 340) : 340;
    const [pos, setPos] = useState(() => ({ x: mobile ? 8 : Math.max(8, window.innerWidth - W - 390), y: mobile ? 130 : 150 }));
    const drag = useRef<any>(null);
    const lastBuilder = useRef('');

    // keep the Market block of the Bot Builder and the shared market in step, both ways
    useEffect(() => {
        if (!open) return;
        const b = builderSymbol();
        if (b && ids.includes(b)) { lastBuilder.current = b; nexus.setSymbol(b); }
        const t = setInterval(() => {
            const cur = builderSymbol();
            if (cur && cur !== lastBuilder.current && ids.includes(cur)) { lastBuilder.current = cur; nexus.setSymbol(cur); }
            else if (nexus.symbol !== lastBuilder.current && ids.includes(nexus.symbol)) { if (setBuilderSymbol(nexus.symbol)) lastBuilder.current = nexus.symbol; }
        }, 600);
        return () => clearInterval(t);
    }, [open]);

    if (!open) return null;
    const clamp = (x: number, y: number) => ({ x: Math.min(window.innerWidth - 60, Math.max(-W + 80, x)), y: Math.min(window.innerHeight - (mobile ? 130 : 80), Math.max(0, y)) });
    return createPortal(
        <div className='nx-mc' style={{ left: pos.x, top: pos.y, width: W }} role='dialog' aria-label='Digit circles'>
            <div
                className='nx-mc__bar'
                onPointerDown={e => ((drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }), e.currentTarget.setPointerCapture(e.pointerId))}
                onPointerMove={e => drag.current && setPos(clamp(e.clientX - drag.current.dx, e.clientY - drag.current.dy))}
                onPointerUp={() => (drag.current = null)}
            >
                <b>Digit circles</b>
                <button className='nx-mc__x' onPointerDown={e => e.stopPropagation()} onClick={toggleMiniCircles} aria-label='Close'>×</button>
            </div>
            <div className='nx-mc__body'>
                <SymbolSelect />
                <DigitCircles small />
            </div>
        </div>,
        document.body
    );
});
