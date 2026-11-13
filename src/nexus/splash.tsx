// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { APP_NAME, TAGLINE, THEME } from './config';

const Crown = () => (
    <svg className='nx-crown' viewBox='0 0 120 100' width='150' height='125' aria-hidden='true'>
        <defs><linearGradient id='qg' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stopColor='#7fb0ff' /><stop offset='0.55' stopColor='#2f6bff' /><stop offset='1' stopColor='#38d5ff' /></linearGradient></defs>
        <path d='M60 6 108 33v54L60 114 12 87V33z' transform='translate(0 -6) scale(1 .9)' fill='url(#qg)' stroke='#ffffff' strokeOpacity='0.75' strokeWidth='2.4' strokeLinejoin='round' />
        <path d='M32 66 50 48l12 12 24-26' fill='none' stroke='#0a2a6b' strokeWidth='7' strokeLinecap='round' strokeLinejoin='round' />
        <path d='M74 34h12v12' fill='none' stroke='#0a2a6b' strokeWidth='7' strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='60' cy='78' r='5' fill='#fff' fillOpacity='0.9' />
    </svg>
);
import { applyTheme } from './theme';
import { mountWelcome } from './welcome';
import { mountEntryGate } from './entry-gate';
import { mountRisk } from './risk-disclaimer';
import { hub } from './ticks-hub';
import './nexus.scss';

const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Splash = ({ onDone }: { onDone: () => void }) => {
    const cv = useRef<HTMLCanvasElement>(null);
    const [out, setOut] = useState(false);
    const [, tick] = useState(0);
    const t0 = useRef(Date.now());
    const ready = useRef({ feed: false, engine: false });
    const feed = hub.status === 'Live';
    const engine = !!(window as any).Blockly?.derivWorkspace;
    ready.current = { feed, engine };
    const saved = (() => {
        try { return JSON.parse(localStorage.getItem('nexus_my_bots') || '[]').length; } catch { return 0; }
    })();

    useEffect(() => {
        // light particle layer: a few dozen plain dots (no blur / shadow effects, which are slow on weak devices)
        const c = cv.current!, g = c.getContext('2d')!;
        c.width = innerWidth;
        c.height = innerHeight;
        const still = reduceMotion();
        const ps = Array.from({ length: 55 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 2 + 0.6, vy: Math.random() * 1.1 + 0.3, c: Math.random() > 0.5 ? THEME.glowA : THEME.glowB }));
        let raf = 0;
        const draw = () => {
            g.clearRect(0, 0, c.width, c.height);
            g.globalAlpha = 0.8;
            ps.forEach(p => {
                if (!still) { p.y -= p.vy; if (p.y < 0) p.y = c.height; }
                g.fillStyle = p.c;
                g.beginPath();
                g.arc(p.x, p.y, p.r, 0, 7);
                g.fill();
            });
            if (!still) raf = requestAnimationFrame(draw);
        };
        draw();
        // pre-warm the market feed while the splash is up, then leave as soon as everything is ready (never before 2.8s, never after 6s)
        hub.watch(['R_100']);
        const off = hub.onChange(() => tick(x => x + 1));
        const poll = setInterval(() => {
            tick(x => x + 1);
            const el = Date.now() - t0.current;
            if (el >= 2800 && ((ready.current.feed && ready.current.engine) || el >= 6000)) setOut(true);
        }, 250);
        return () => (cancelAnimationFrame(raf), off(), clearInterval(poll));
    }, []);
    useEffect(() => {
        if (!out) return;
        const t = setTimeout(onDone, 700);
        return () => clearTimeout(t);
    }, [out]);

    const elapsed = Math.min(Date.now() - t0.current, 2800);
    const pct = out ? 100 : Math.min(95, (elapsed / 2800) * 60 + (feed ? 20 : 0) + (engine ? 20 : 0));
    return (
        <div className={`nx-splash ${out ? 'is-out' : ''}`}>
            <canvas ref={cv} />
            <div className='nx-splash__text'>
                <div className='nx-splash__hero'><Crown /></div>
                <small>Loading...</small>
                <h1>{APP_NAME}</h1>
                <p>“{TAGLINE}”</p>
                <div className='nx-splash__bar'><i style={{ width: `${pct}%` }} /></div>
                <div className='nx-splash__steps'>
                    <span className={feed ? 'ok' : ''}>{feed ? '✓' : '·'} Market feed {feed ? 'live' : 'connecting'}</span>
                    <span className={engine ? 'ok' : ''}>{engine ? '✓' : '·'} Trading engine {engine ? 'ready' : 'starting'}</span>
                    <span className='ok'>✓ {saved} saved bot{saved === 1 ? '' : 's'}</span>
                </div>
            </div>
        </div>
    );
};

/** Shown the moment the site opens, in its own React root so it appears before the app finishes loading. */
export const mountSplash = () => {
    applyTheme(); // theme colours first, so the splash draws in them
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = ReactDOM.createRoot(el);
    root.render(<Splash onDone={() => (root.unmount(), el.remove(), mountRisk(), mountEntryGate(mountWelcome))} />);
};
