import React from 'react';
import { THEME } from './config';

/** Original vector robot artwork (no image files). Each seed gives a different head, eyes and antenna. */
export type RobotLook = { head: number; eyes: number; antenna: number; accent: string };
const ACCENTS = ['#2be3a0', '#4de2ff', '#b04dff', '#ff9d4d', '#ff4d6d', '#ffd84d'];

export const lookFor = (seed: number, accent?: string): RobotLook => {
    const r = (n: number) => Math.abs(Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1;
    return { head: Math.floor(r(1) * 4), eyes: Math.floor(r(2) * 3), antenna: Math.floor(r(3) * 3), accent: accent ?? ACCENTS[Math.floor(r(4) * ACCENTS.length)] };
};

/** Head and shoulders, drawn in a 200 x 200 box. */
export const Figure = ({ look, uid }: { look: RobotLook; uid: string }) => {
    const { head, eyes, antenna, accent } = look;
    const w = [104, 112, 96, 108][head], x0 = 100 - w / 2, rx = [22, 10, 34, 16][head];
    const eye = (shape: React.ReactNode, glow = false) => <g className='rb-eye' filter={glow ? `url(#${uid}g)` : undefined} opacity={glow ? 0.8 : 1}>{shape}</g>;
    const eyeShape =
        eyes === 0 ? <><rect x={100 - w * 0.2 - 10} y='71' width='22' height='12' rx='5' fill={accent} /><rect x={100 + w * 0.2 - 12} y='71' width='22' height='12' rx='5' fill={accent} /></>
        : eyes === 1 ? <rect x={x0 + 22} y='72' width={w - 44} height='10' rx='5' fill={accent} />
        : <><circle cx='100' cy='77' r='12' fill={accent} /><circle cx='100' cy='77' r='4.5' fill='#090d1a' /></>;
    return (
        <g>
            <defs><filter id={`${uid}g`} x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='3.5' /></filter></defs>
            <path d='M26 200 C32 160 60 146 100 146 C140 146 168 160 174 200 Z' fill='#222a46' />
            <circle cx='100' cy='174' r='6' fill={accent} className='rb-pulse' />
            <rect x='86' y='120' width='28' height='30' rx='6' fill='#1a2038' />
            {antenna >= 1 && <><line x1='100' y1='38' x2='100' y2='17' stroke='#3f4a78' strokeWidth='4' /><circle cx='100' cy='13' r='6' fill={accent} className='rb-blink' /></>}
            {antenna === 2 && <><line x1={x0 + 14} y1='40' x2={x0 + 6} y2='24' stroke='#3f4a78' strokeWidth='3' /><line x1={x0 + w - 14} y1='40' x2={x0 + w - 6} y2='24' stroke='#3f4a78' strokeWidth='3' /></>}
            <rect x={x0 - 12} y='64' width='12' height='34' rx='5' fill='#2f3860' />
            <rect x={x0 + w} y='64' width='12' height='34' rx='5' fill='#2f3860' />
            <rect x={x0} y='36' width={w} height='88' rx={rx} fill='#2b3354' stroke='#3f4a78' strokeWidth='2' />
            <rect x={x0 + 12} y='52' width={w - 24} height='52' rx={Math.min(rx, 14)} fill='#090d1a' />
            {eye(eyeShape, true)}
            {eye(eyeShape)}
            {[0, 1, 2, 3].map(i => <line key={i} x1='84' x2='116' y1={110 + i * 3.4} y2={110 + i * 3.4} stroke='#4a5688' strokeWidth='1.6' />)}
        </g>
    );
};

/** Square thumbnail robot (used for the Free Bots). */
export const RobotAvatar = ({ seed, accent, size = 84 }: { seed: number; accent?: string; size?: number }) => (
    <svg className='nx-robot' viewBox='0 0 200 200' width={size} height={size} role='img' aria-label='AI robot'>
        <Figure look={lookFor(seed, accent)} uid={`rb${seed}`} />
    </svg>
);

// A short candle run: the red candles near the robot are the ones it strikes.
const CANDLES = (() => {
    let p = 175;
    return Array.from({ length: 19 }, (_, i) => {
        const d = Math.sin(i * 1.7) * 16 + (i % 3 === 0 ? 12 : -6);
        const open = p; p = Math.max(130, Math.min(228, p + d));
        const hit = i === 4 || i === 5 || i === 13 || i === 14;
        const up = hit ? false : p < open;
        return { x: 24 + i * 24, top: Math.min(open, p), h: Math.abs(p - open) + 8, up, hit };
    });
})();

/** Opening scene: the robot strikes the market. Eyes pulse, lightning hits the red candles, the candles buckle. */
export const RobotHero = () => (
    <svg className='nx-hero' viewBox='0 0 480 270' role='img' aria-label='A robot striking the market with lightning'>
        {[60, 110, 160, 210].map(y => <line key={y} x1='10' x2='470' y1={y} y2={y} stroke='rgba(255,255,255,.06)' />)}
        {CANDLES.map(c => (
            <g key={c.x} className={c.hit ? 'rh-hit' : undefined}>
                <line x1={c.x} x2={c.x} y1={c.top - 10} y2={c.top + c.h + 10} stroke={c.up ? '#2be3a0' : '#ff4d5e'} strokeWidth='2' />
                <rect x={c.x - 7} y={c.top} width='14' height={c.h} rx='2' fill={c.up ? '#2be3a0' : '#ff4d5e'} />
            </g>
        ))}
        <g transform='translate(140 0)'><Figure look={{ head: 1, eyes: 1, antenna: 2, accent: THEME.down }} uid='hero' /></g>
        <polyline className='rh-bolt' points='218,80 190,100 200,106 160,140 172,146 120,196' />
        <polyline className='rh-bolt rh-bolt--b' points='262,80 290,100 280,106 320,140 308,146 360,196' />
    </svg>
);

/** Wide banner for a Free Bots card: glowing backdrop, faint candles, the robot, and a label panel for the bot's trade. */
export const RobotBanner = ({ seed, accent, kind }: { seed: number; accent: string; kind: 'over' | 'under' | 'even' | 'odd' | 'rise' | 'fall' }) => {
    const uid = `bn${seed}`;
    const upward = kind === 'over' || kind === 'rise' || kind === 'even';
    const bars = Array.from({ length: 16 }, (_, i) => 18 + Math.abs(Math.sin(seed * 3.1 + i * 1.3)) * 46);
    return (
        <svg viewBox='0 0 320 200' preserveAspectRatio='xMidYMid slice' role='img' aria-label='AI robot'>
            <defs>
                <linearGradient id={`${uid}bg`} x1='0' y1='0' x2='1' y2='1'><stop offset='0' stopColor='#0b0f1d' /><stop offset='1' stopColor={accent} stopOpacity='0.5' /></linearGradient>
                <radialGradient id={`${uid}gl`} cx='50%' cy='45%' r='50%'><stop offset='0' stopColor={accent} stopOpacity='0.6' /><stop offset='1' stopColor={accent} stopOpacity='0' /></radialGradient>
            </defs>
            <rect width='320' height='200' fill={`url(#${uid}bg)`} />
            {bars.map((h, i) => <rect key={i} x={10 + i * 19.5} y={200 - h} width='9' height={h} rx='1.5' fill={accent} opacity='0.18' />)}
            <circle cx='160' cy='88' r='96' fill={`url(#${uid}gl)`} />
            <g transform='translate(60 8)' className='nx-robot'><Figure look={lookFor(seed, accent)} uid={uid} /></g>
            <g>
                <rect x='12' y='66' width='60' height='50' rx='8' fill='rgba(8,10,22,.7)' stroke={accent} strokeWidth='1.5' />
                <text x='42' y='88' textAnchor='middle' fontSize='18' fill={accent}>{upward ? '▲' : '▼'}</text>
                <text x='42' y='107' textAnchor='middle' fontSize='11' fontWeight='700' fill='#fff' letterSpacing='1'>{kind.toUpperCase()}</text>
                <rect x='248' y='66' width='60' height='50' rx='8' fill='rgba(8,10,22,.7)' stroke={accent} strokeWidth='1.5' />
                {[0, 1, 2, 3, 4].map(i => <rect key={i} x={258 + i * 9} y={104 - (14 + ((seed + i * 3) % 5) * 7)} width='6' height={14 + ((seed + i * 3) % 5) * 7} rx='1' fill={accent} />)}
            </g>
        </svg>
    );
};
