import React from 'react';
import { Figure, lookFor } from './robot';

/** Premium thumbnail: gold and violet, rotating ring, hex grid, light sweep. `art` changes the side panels. Original vector artwork. */
export const PremiumBanner = ({ art, seed }: { art: 'scan' | 'rotate' | 'overunder' | 'evenodd' | 'quad'; seed: number }) => {
    const uid = `pm${seed}`;
    const gold = '#38d5ff';
    const violet = '#2f6bff';
    const label = { scan: 'SCAN', rotate: 'ROTATE', overunder: 'OVER ⇄ UNDER', evenodd: 'EVEN ⇄ ODD', quad: '4-WAY' }[art];
    const hexes = Array.from({ length: 28 }, (_, i) => ({ x: 20 + (i % 7) * 46 + (Math.floor(i / 7) % 2) * 23, y: 22 + Math.floor(i / 7) * 40 }));
    const side = (x: number) => {
        if (art === 'scan') return [0, 1, 2, 3].map(i => <rect key={i} x={x + 6} y={74 + i * 10} width={34 - ((seed * 7 + i * 9) % 18)} height='5' rx='2.5' fill={gold} opacity={0.9 - i * 0.15} />);
        if (art === 'rotate') return <g><circle cx={x + 24} cy='92' r='15' fill='none' stroke={gold} strokeWidth='3' strokeDasharray='60 40' className='pm-spin' /><circle cx={x + 24} cy='92' r='4' fill={gold} /></g>;
        if (art === 'quad') return [0, 1, 2, 3].map(i => <rect key={i} x={x + 6 + (i % 2) * 20} y={74 + Math.floor(i / 2) * 20} width='16' height='14' rx='3' fill={i % 2 ? violet : gold} opacity='0.85' />);
        const [a, b] = art === 'overunder' ? ['▲', '▼'] : ['E', 'O'];
        return <><text x={x + 24} y='88' textAnchor='middle' fontSize='18' fontWeight='800' fill={gold}>{a}</text><text x={x + 24} y='112' textAnchor='middle' fontSize='18' fontWeight='800' fill={violet}>{b}</text></>;
    };
    return (
        <svg viewBox='0 0 320 200' preserveAspectRatio='xMidYMid slice' role='img' aria-label='Premium bot'>
            <defs>
                <linearGradient id={`${uid}bg`} x1='0' y1='0' x2='1' y2='1'><stop offset='0' stopColor='#0f1a3d' /><stop offset='0.55' stopColor='#22337a' /><stop offset='1' stopColor='#6a2f6e' /></linearGradient>
                <radialGradient id={`${uid}gl`} cx='50%' cy='48%' r='50%'><stop offset='0' stopColor={gold} stopOpacity='0.55' /><stop offset='1' stopColor={violet} stopOpacity='0' /></radialGradient>
                <linearGradient id={`${uid}ring`} x1='0' y1='0' x2='1' y2='1'><stop offset='0' stopColor={gold} /><stop offset='1' stopColor={violet} /></linearGradient>
                <linearGradient id={`${uid}sh`} x1='0' y1='0' x2='1' y2='0'><stop offset='0' stopColor='#fff' stopOpacity='0' /><stop offset='0.5' stopColor='#fff' stopOpacity='0.22' /><stop offset='1' stopColor='#fff' stopOpacity='0' /></linearGradient>
            </defs>
            <rect width='320' height='200' fill={`url(#${uid}bg)`} />
            {hexes.map((h, i) => <polygon key={i} points={`${h.x},${h.y - 14} ${h.x + 12},${h.y - 7} ${h.x + 12},${h.y + 7} ${h.x},${h.y + 14} ${h.x - 12},${h.y + 7} ${h.x - 12},${h.y - 7}`} fill='none' stroke={gold} strokeOpacity='0.1' />)}
            <circle cx='160' cy='92' r='100' fill={`url(#${uid}gl)`} />
            <g className='pm-ring'><circle cx='160' cy='92' r='78' fill='none' stroke={`url(#${uid}ring)`} strokeWidth='2.5' strokeDasharray='4 10' /></g>
            <circle cx='160' cy='92' r='64' fill='none' stroke={gold} strokeOpacity='0.35' />
            <g transform='translate(60 8)' className='nx-robot'><Figure look={lookFor(seed * 5 + 2, gold)} uid={uid} /></g>
            <g>
                <rect x='10' y='64' width='52' height='60' rx='9' fill='rgba(10,6,28,.78)' stroke={gold} strokeWidth='1.4' />
                {side(10)}
                <rect x='258' y='64' width='52' height='60' rx='9' fill='rgba(10,6,28,.78)' stroke={violet} strokeWidth='1.4' />
                {[0, 1, 2, 3, 4].map(i => <rect key={i} x={266 + i * 8} y={112 - (12 + ((seed + i * 3) % 5) * 8)} width='5' height={12 + ((seed + i * 3) % 5) * 8} rx='1' fill={violet} />)}
            </g>
            <rect x='96' y='168' width='128' height='22' rx='11' fill='rgba(10,6,28,.8)' stroke={gold} strokeOpacity='0.7' />
            <text x='160' y='183' textAnchor='middle' fontSize='11' fontWeight='800' letterSpacing='2' fill={gold}>{label}</text>
            <path d='M138 14 l8 10 l14 -14 l14 14 l8 -10 l-4 18 h-36 z' fill={gold} opacity='0.95' />
            <rect className='pm-sweep' x='-120' y='0' width='90' height='200' fill={`url(#${uid}sh)`} transform='skewX(-20)' />
        </svg>
    );
};
