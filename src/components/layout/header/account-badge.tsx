import React from 'react';

/** 5-point star polygon centred at (cx, cy). */
const star = (cx: number, cy: number, R = 3.1, r = 1.25) =>
    Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 ? r : R;
        return `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
    }).join(' ');

// The standard US flag (190 x 100): 13 horizontal stripes, canton over the top 7 stripes, 50 stars in 9 rows of 6 / 5.
const STRIPE = 100 / 13;
const STARS = Array.from({ length: 9 }, (_, row) => {
    const six = row % 2 === 0;
    return Array.from({ length: six ? 6 : 5 }, (_, i) => ({ x: (six ? 6.33 : 12.67) + i * 12.67, y: 5.385 * (row + 1) }));
}).flat();

/**
 * US flag for a real account. The round badge shows the left 100 x 100 of the flag (hoist end), zoomed in so it
 * fills the circle: all 13 stripes, the canton and its stars; the circular edge trims only the far corners.
 */
const UsFlag = () => (
    <svg viewBox='0 0 100 100' width='100%' height='100%' aria-hidden='true'>
        <rect width='190' height='100' fill='#fff' />
        {Array.from({ length: 7 }, (_, i) => <rect key={i} y={i * 2 * STRIPE} width='190' height={STRIPE} fill='#B22234' />)}
        <rect width='76' height={7 * STRIPE} fill='#2A2F6B' />
        {STARS.map((s, i) => <polygon key={i} points={star(s.x, s.y)} fill='#fff' />)}
    </svg>
);

/** Teal disc with a white "D" crossed by two bars on its left side (demo account). */
const DemoD = () => (
    <svg viewBox='0 0 100 100' width='100%' height='100%' aria-hidden='true'>
        <rect width='100' height='100' fill='#5E9AA1' />
        <path d='M36 27 H50 C66 27 75 37 75 50 C75 63 66 73 50 73 H36 Z' fill='none' stroke='#EAF6F6' strokeWidth='7' strokeLinejoin='round' />
        <line x1='23' y1='43' x2='47' y2='43' stroke='#EAF6F6' strokeWidth='5' strokeLinecap='round' />
        <line x1='23' y1='57' x2='47' y2='57' stroke='#EAF6F6' strokeWidth='5' strokeLinecap='round' />
    </svg>
);

/**
 * Account type marker: circular US flag for a real account, circular "D" badge for a demo account.
 * Drawn as inline SVG, so no image files are needed and it stays sharp at any size.
 */
export const AccountBadge = ({ isVirtual }: { isVirtual: boolean }) => (
    <span
        className={`acc-badge ${isVirtual ? 'acc-badge--demo' : 'acc-badge--real'}`}
        role='img'
        aria-label={isVirtual ? 'Demo account' : 'Real account (US flag)'}
        title={isVirtual ? 'Demo account' : 'Real account'}
    >
        {isVirtual ? <DemoD /> : <UsFlag />}
    </span>
);
