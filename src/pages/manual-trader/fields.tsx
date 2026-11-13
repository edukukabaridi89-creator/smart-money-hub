// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { fetchProposal, type Quote } from '@/nexus/dtrader/market-data';

/** Live price for one request; refreshed every few seconds while the settings stay valid. */
export const useQuote = (params: Record<string, unknown> | null, key: string) => {
    const [state, setState] = useState<{ q?: Quote; loading: boolean }>({ loading: !!params });
    useEffect(() => {
        if (!params) return setState({ loading: false });
        let live = true;
        setState(s => ({ ...s, loading: true }));
        const run = async () => {
            const q = await fetchProposal(params);
            if (live) setState({ q, loading: false });
        };
        const t = setTimeout(run, 300);
        const iv = setInterval(run, 2500);
        return () => { live = false; clearTimeout(t); clearInterval(iv); };
    }, [key]);
    return state;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Number with − / + buttons and a currency or unit label (the stake box in the trader). */
export const Stepper = ({ value, onChange, min = 0.01, step, suffix, integer = false, max }: any) => {
    const [t, setT] = useState(String(value));
    useEffect(() => { if (Number(t) !== value) setT(String(value)); }, [value]);
    const inc = (dir: number) => {
        const s = step ?? (integer || value >= 1 ? 1 : 0.05);
        const n = Math.min(max ?? Infinity, Math.max(min, r2(value + dir * s)));
        onChange(integer ? Math.round(n) : n);
    };
    return (
        <div className='dt-step'>
            <button type='button' onClick={() => inc(-1)} aria-label='Decrease'>−</button>
            <input
                inputMode={integer ? 'numeric' : 'decimal'}
                value={t}
                onChange={e => { setT(e.target.value); const n = Number(e.target.value); if (n >= min && (max === undefined || n <= max) && (!integer || Number.isInteger(n))) onChange(n); }}
                onBlur={() => setT(String(value))}
                aria-label='Amount'
            />
            {suffix && <span>{suffix}</span>}
            <button type='button' onClick={() => inc(1)} aria-label='Increase'>+</button>
        </div>
    );
};

export const Check = ({ on, onChange, label, children }: any) => (
    <div className='dt-card'>
        <label className='dt-check'><input type='checkbox' checked={on} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>
        {on && children}
    </div>
);
