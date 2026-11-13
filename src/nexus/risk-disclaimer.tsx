// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

/** Risk disclaimer. Edit the wording here. Set NEXT_PUBLIC_RISK_DISCLAIMER=none to turn the whole thing off. */
export const RISK_TITLE = 'Risk Disclaimer';
export const RISK_PARAGRAPHS = [
    'Deriv offers complex derivatives, such as options and contracts for difference ("CFDs"). These products may not be suitable for all clients, and trading them puts you at risk.',
    'Please understand the following risks before trading Deriv products:',
];
export const RISK_POINTS = [
    'a) You may lose some or all of the money you invest in the trade',
    'b) If your trade involves currency conversion, exchange rates will affect your profit and loss. You should never trade with borrowed money or with money that you cannot afford to lose.',
];

const POS = 'nx_risk_pos';
const SIZE = 36;
const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(4, x), window.innerWidth - SIZE - 4),
    y: Math.min(Math.max(4, y), window.innerHeight - SIZE - 4),
});
const loadPos = () => {
    try {
        const p = JSON.parse(localStorage.getItem(POS) || 'null');
        if (p && typeof p.x === 'number') return clamp(p.x, p.y);
    } catch (e) {}
    return window.innerWidth > 1024 ? clamp(18, window.innerHeight - 100) : clamp(10, window.innerHeight - 250);
};

const Risk = () => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(loadPos);
    const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);

    useEffect(() => {
        const onResize = () => setPos(p => clamp(p.x, p.y));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const down = (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, sx: e.clientX, sy: e.clientY, moved: false };
    };
    const move = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
        d.moved = true;
        setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
    };
    const up = () => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) {
            try { localStorage.setItem(POS, JSON.stringify(pos)); } catch (e) {}
        } else {
            setOpen(o => !o);
        }
    };

    return (
        <>
            {open && (
                <div className='nx-risk__backdrop' onClick={() => setOpen(false)}>
                    <div className='nx-risk' role='dialog' aria-modal='true' aria-label={RISK_TITLE} onClick={e => e.stopPropagation()}>
                        <button className='nx-risk__x' onClick={() => setOpen(false)} aria-label='Close'>✕</button>
                        <h3>{RISK_TITLE}</h3>
                        {RISK_PARAGRAPHS.map(t => <p key={t}>{t}</p>)}
                        {RISK_POINTS.map(t => <p key={t}>{t}</p>)}
                    </div>
                </div>
            )}
            <button
                className='nx-risk__fab'
                style={{ left: pos.x, top: pos.y }}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={() => (drag.current = null)}
                aria-label={RISK_TITLE}
                title={`${RISK_TITLE} (drag to move)`}
            >
                <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'>
                    <path d='M12 3.2 22 20.5H2z' fill='#fff' stroke='#fff' strokeWidth='1.6' strokeLinejoin='round' />
                    <rect x='11' y='9' width='2' height='6' rx='1' fill='#e5484d' />
                    <circle cx='12' cy='17.4' r='1.2' fill='#e5484d' />
                </svg>
            </button>
        </>
    );
};

export const mountRisk = () => {
    if (String(process.env.NEXT_PUBLIC_RISK_DISCLAIMER || '').trim().toLowerCase() === 'none') return;
    if (document.getElementById('nx-risk-root')) return;
    const el = document.createElement('div');
    el.id = 'nx-risk-root';
    document.body.appendChild(el);
    ReactDOM.createRoot(el).render(<Risk />);
};
