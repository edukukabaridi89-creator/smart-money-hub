// @ts-nocheck
import React from 'react';
import { Figure, lookFor } from './robot';

/** Smart Money Hub card artwork: a crowned robot with a blue visor, a bar chart on the left and the trade type on the right. */
export const HubBanner = ({ seed, accent, kind }: { seed: number; accent: string; kind: 'over' | 'under' | 'even' | 'odd' | 'rise' | 'fall' }) => {
    const uid = `qb${seed}`;
    const upward = kind === 'over' || kind === 'rise' || kind === 'even';
    const look = { ...lookFor(seed, '#38d5ff'), antenna: 0 };
    const dots = Array.from({ length: 6 * 10 }, (_, i) => ({ x: 16 + (i % 10) * 32 + (Math.floor(i / 10) % 2) * 16, y: 14 + Math.floor(i / 10) * 32 }));
    return (
        <svg viewBox='0 0 320 200' preserveAspectRatio='xMidYMid slice' role='img' aria-label='Hub robot'>
            <defs>
                <linearGradient id={`${uid}bg`} x1='0' y1='0' x2='1' y2='1'><stop offset='0' stopColor='#0a1c4a' /><stop offset='0.6' stopColor='#1a4bb8' /><stop offset='1' stopColor='#1f4fc4' /></linearGradient>
                <radialGradient id={`${uid}gl`} cx='50%' cy='45%' r='50%'><stop offset='0' stopColor='#38d5ff' stopOpacity='0.55' /><stop offset='1' stopColor='#2f6bff' stopOpacity='0' /></radialGradient>
                <linearGradient id={`${uid}cr`} x1='0' y1='0' x2='1' y2='1'><stop offset='0' stopColor='#cfe0ff' /><stop offset='0.55' stopColor={accent} /><stop offset='1' stopColor='#38d5ff' /></linearGradient>
            </defs>
            <rect width='320' height='200' fill={`url(#${uid}bg)`} />
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r='1.8' fill='#fff' opacity='0.14' />)}
            <circle cx='160' cy='92' r='98' fill={`url(#${uid}gl)`} />
            <g transform='translate(60 22)' className='nx-robot'>
                <Figure look={look} uid={uid} />
                <circle cx='100' cy='6' r='17' fill={`url(#${uid}cr)`} stroke='#fff' strokeOpacity='0.85' strokeWidth='1.8' />
                <text x='100' y='13' textAnchor='middle' fontSize='20' fontWeight='800' fill='#0a2a6b'>$</text>
            </g>
            <g>
                <rect x='12' y='66' width='60' height='50' rx='14' fill='rgba(10,16,40,.72)' stroke='#7fb0ff' strokeWidth='1.5' />
                {[0, 1, 2, 3, 4].map(i => { const h = 14 + ((seed + i * 3) % 5) * 7; return <rect key={i} x={22 + i * 9} y={104 - h} width='6' height={h} rx='3' fill={i % 2 ? '#7fb0ff' : '#38d5ff'} />; })}
                <rect x='248' y='66' width='60' height='50' rx='14' fill='rgba(10,16,40,.72)' stroke='#38d5ff' strokeWidth='1.5' />
                <text x='278' y='88' textAnchor='middle' fontSize='18' fill='#38d5ff'>{upward ? '▲' : '▼'}</text>
                <text x='278' y='107' textAnchor='middle' fontSize='11' fontWeight='700' fill='#fff' letterSpacing='1'>{kind.toUpperCase()}</text>
            </g>
        </svg>
    );
};
