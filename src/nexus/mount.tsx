// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useDevice } from '@deriv-com/ui';
import { useStore } from '@/hooks/useStore';
import { useAutoEngine } from './auto-engine';
import { APP_NAME } from './config';
import { DemoLimitPopup } from './demo-limit-popup';
import { GreetingPopup } from './greeting';
import { startGuard } from './guard';
import { MiniCirclesPanel } from './mini-circles';
import { nexus } from './store';
import './nexus.scss';

/** Small, draggable spinning "AI" circle. Tap it to open the Auto Trader tab. */
const AiOrb = observer(() => {
    const [pos, setPos] = useState(() => (window.innerWidth > 1024 ? { x: 18, y: window.innerHeight - 160 } : { x: window.innerWidth - 56, y: window.innerHeight - 250 }));
    const drag = useRef<any>(null);
    return (
        <div
            className={`nx-ai ${nexus.autoOn ? 'is-on' : ''}`}
            style={{ left: pos.x, top: pos.y }}
            title='Auto Trader'
            onPointerDown={e => ((drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false }), e.currentTarget.setPointerCapture(e.pointerId))}
            onPointerMove={e => {
                const d = drag.current;
                if (!d) return;
                if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
                if (d.moved) setPos({ x: Math.min(innerWidth - 52, Math.max(0, e.clientX - d.dx)), y: Math.min(innerHeight - 52, Math.max(0, e.clientY - d.dy)) });
            }}
            onPointerUp={() => {
                if (drag.current && !drag.current.moved) nexus.goTab(DBOT_TABS.AUTO_TRADER);
                drag.current = null;
            }}
        >
            <span>AI</span>
        </div>
    );
});

export const NexusMount = observer(() => {
    const root = useStore();
    nexus.root = root; // lets the trade dispatcher reach run_panel / transactions / dashboard
    const { isDesktop } = useDevice();
    const runPanelOpen = root.run_panel?.is_drawer_open;
    // Summary / Transactions / Journal start open on the right of every page (desktop), so a trade shows up without navigating anywhere
    useEffect(() => startGuard(), []);
    useEffect(() => {
        if (isDesktop) root.run_panel?.toggleDrawer(true);
    }, [isDesktop]);
    useEffect(() => {
        document.body.classList.toggle('nx-run-open', !!runPanelOpen && isDesktop); // lets the Dashboard make room for the panel
    }, [runPanelOpen, isDesktop]);
    useAutoEngine();
    useEffect(() => {
        document.title = APP_NAME;
        nexus.bindBlockly();
    }, []);

    return (
        <>
            <AiOrb />
            <GreetingPopup />
            <DemoLimitPopup />
            <MiniCirclesPanel />
            {nexus.notice && <div className='nx-toast'>{nexus.notice}</div>}
        </>
    );
});
