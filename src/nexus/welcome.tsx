// @ts-nocheck
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { WELCOME_MESSAGE } from './config';
import { helloDue } from './hello-key';

const Typer = ({ onDone }: { onDone: () => void }) => {
    const [n, setN] = useState(0);
    const [out, setOut] = useState(false);
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    useEffect(() => {
        if (still) return setN(WELCOME_MESSAGE.length);
        const t = setInterval(() => setN(x => (x >= WELCOME_MESSAGE.length ? x : x + 1)), 42);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        if (n < WELCOME_MESSAGE.length) return;
        const a = setTimeout(() => setOut(true), 4500);
        const b = setTimeout(onDone, 5200);
        return () => (clearTimeout(a), clearTimeout(b));
    }, [n]);
    return (
        <div className={`nx-welcome ${out ? 'is-out' : ''}`} role='status' aria-live='polite' onClick={() => (setOut(true), setTimeout(onDone, 500))}>
            <span>{WELCOME_MESSAGE.slice(0, n)}</span>
            {n < WELCOME_MESSAGE.length && <i className='nx-welcome__caret' />}
        </div>
    );
};

/** Typed greeting shown in blue once the splash has gone. Empty WELCOME_MESSAGE (config.ts) turns it off. */
export const mountWelcome = () => {
    if (!WELCOME_MESSAGE || helloDue()) return; // the hello pop-up covers first-time logins
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = ReactDOM.createRoot(el);
    root.render(<Typer onDone={() => (root.unmount(), el.remove())} />);
};
