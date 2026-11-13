// @ts-nocheck
import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { SYMBOLS, symbolName } from './config';
import { hub } from './ticks-hub';
import { nexus } from './store';

/** Re-render on new ticks (rAF-throttled) and make sure the symbols are streaming. */
export const useHub = (symbols: string[]) => {
    const [, bump] = useReducer(x => x + 1, 0);
    useEffect(() => {
        hub.watch(symbols);
        let raf = 0;
        const off = hub.onChange(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(bump);
        }, symbols);
        return () => (off(), cancelAnimationFrame(raf));
    }, [symbols.join(',')]);
};

export const SymbolSelect = observer(() => (
    <select className='nx-input' value={nexus.symbol} onChange={e => nexus.setSymbol(e.target.value)}>
        {SYMBOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
));

/**
 * Digit circles for the last 1,000 ticks. A cursor slides to the circle of the latest digit on every tick.
 * `trigger` marks the entry digit chosen by the Auto Trader scan.
 */
export const DigitCircles = observer(({ symbol, trigger = null, small = false }: { symbol?: string; trigger?: number | null; small?: boolean }) => {
    const sym = symbol ?? nexus.symbol;
    useHub([sym]);
    const cells = useRef<HTMLDivElement[]>([]);
    const cursor = useRef<HTMLDivElement>(null);
    const dist = hub.distribution(sym);
    const f = hub.feed(sym);
    const n = f?.digits.length ?? 0;
    const last = f?.digits.at(-1);
    // rank digits by share: most = green, 2nd most = blue, 2nd least = orange, least = red
    const order = dist.map((p, d) => [p, d]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(x => x[1]);
    const rank = n ? { [order[0]]: 'is-top1', [order[1]]: 'is-top2', [order[8]]: 'is-low2', [order[9]]: 'is-low1' } : {};
    const sum = (ds: number[]) => ds.reduce((a, d) => a + dist[d], 0);

    useLayoutEffect(() => {
        const el = last !== undefined ? cells.current[last] : null;
        if (el && cursor.current) cursor.current.style.transform = `translate(${el.offsetLeft + el.offsetWidth / 2}px, ${el.offsetTop}px)`;
    });

    return (
        <div className={`nx-dc ${small ? 'nx-dc--sm' : ''}`}>
            <div className='nx-dc__head'>
                <b>{symbolName(sym)}</b>
                <span>{f?.last ?? '—'}</span>
                <span className='nx-muted'>{n}/1000 ticks</span>
                <span className={`nx-pill ${hub.status === 'Live' ? 'ok' : ''}`}>{hub.isUnavailable(sym) ? 'Market unavailable' : hub.status}</span>
            </div>
            <div className='nx-circles'>
                <div className='nx-cursor' ref={cursor} style={{ opacity: last === undefined ? 0 : 1 }}>▼</div>
                {dist.map((p, d) => (
                    <div key={d} ref={el => (cells.current[d] = el)} className={`nx-circle ${rank[d] ?? ''} ${d === last ? 'is-last' : ''} ${d === trigger ? 'is-trigger' : ''}`} style={{ '--p': `${Math.min(p * 5, 100)}%` }}>
                        <b>{d}</b>
                        <span>{n ? p.toFixed(1) : '--'}%</span>
                        {d === trigger && <i>ENTRY</i>}
                    </div>
                ))}
            </div>
            <div className='nx-legend'>
                <span><i style={{ background: '#2be3a0' }} />Most</span>
                <span><i style={{ background: '#3b82ff' }} />2nd most</span>
                <span><i style={{ background: '#ffa93b' }} />2nd least</span>
                <span><i style={{ background: '#ff4d5e' }} />Least</span>
            </div>
            <div className='nx-trail'>
                {(f?.digits.slice(-30) ?? []).map((d, i, a) => <span key={i} className={i === a.length - 1 ? 'now' : ''}>{d}</span>)}
            </div>
            {n > 0 && (
                <div className='nx-dstats'>
                    <span>Even <b>{sum([0, 2, 4, 6, 8]).toFixed(1)}%</b></span>
                    <span>Odd <b>{sum([1, 3, 5, 7, 9]).toFixed(1)}%</b></span>
                    <span>0–4 <b>{sum([0, 1, 2, 3, 4]).toFixed(1)}%</b></span>
                    <span>5–9 <b>{sum([5, 6, 7, 8, 9]).toFixed(1)}%</b></span>
                </div>
            )}
        </div>
    );
});

export const TickChart = observer(() => {
    useHub([nexus.symbol]);
    const ref = useRef<HTMLCanvasElement>(null);
    const prices = (hub.feed(nexus.symbol)?.prices ?? []).slice(-200);
    useEffect(() => {
        const c = ref.current;
        if (!c || prices.length < 2) return;
        const g = c.getContext('2d')!;
        const w = (c.width = c.clientWidth * 2), h = (c.height = c.clientHeight * 2);
        const min = Math.min(...prices), max = Math.max(...prices), r = max - min || 1;
        const X = i => (i / (prices.length - 1)) * (w - 20) + 10, Y = p => h - 24 - ((p - min) / r) * (h - 48);
        g.clearRect(0, 0, w, h);
        g.strokeStyle = '#4de2ff'; g.lineWidth = 3; g.shadowColor = '#4de2ff'; g.shadowBlur = 12;
        g.beginPath();
        prices.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](X(i), Y(p)));
        g.stroke();
        g.shadowBlur = 0; g.fillStyle = '#fff';
        g.beginPath(); g.arc(X(prices.length - 1), Y(prices.at(-1)), 6, 0, 7); g.fill();
    });
    return <canvas ref={ref} className='nx-chart' />;
});

export const Panel = ({ title, children, className = '' }: any) => (
    <section className={`nx-panel ${className}`}>
        {title && <h3>{title}</h3>}
        {children}
    </section>
);
export const Field = ({ label, children }: any) => (
    <label className='nx-field'>
        <span>{label}</span>
        {children}
    </label>
);
/**
 * Number input that physically can't leave [min, max]: the upper bound (and the lower bound for whole numbers) is
 * enforced as you type, '-' / 'e' are blocked, and decimals (e.g. stake) are raised to `min` when you leave the field.
 */
export const Num = ({ value, onChange, min = -Infinity, max = Infinity, int = false, ...rest }: any) => {
    const [text, setText] = useState(String(value));
    useEffect(() => {
        if (Number(text) !== value) setText(String(value));
    }, [value]);
    const clamp = (n: number, lower: boolean) => Math.min(max, lower ? Math.max(min, int ? Math.trunc(n) : n) : int ? Math.trunc(n) : n);
    return (
        <input
            className='nx-input'
            type='number'
            inputMode={int ? 'numeric' : 'decimal'}
            min={Number.isFinite(min) ? min : undefined}
            max={Number.isFinite(max) ? max : undefined}
            value={text}
            onKeyDown={e => (['e', 'E', '+'].includes(e.key) || (e.key === '-' && min >= 0) || (int && e.key === '.')) && e.preventDefault()}
            onChange={e => {
                const raw = e.target.value;
                if (raw === '') return setText('');
                const n = Number(raw);
                if (Number.isNaN(n)) return;
                const c = clamp(n, int);
                setText(c !== n ? String(c) : raw);
                if (c >= min) onChange(c);
            }}
            onBlur={() => {
                const c = clamp(text === '' || Number.isNaN(Number(text)) ? value : Number(text), true);
                setText(String(c));
                onChange(c);
            }}
            {...rest}
        />
    );
};
