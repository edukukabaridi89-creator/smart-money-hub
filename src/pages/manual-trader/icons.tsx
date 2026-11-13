// @ts-nocheck
import React from 'react';

const C = '#ff6b78'; // the blue-red the Deriv trader uses for its trade-type icons
const Glyph = ({ kind }: { kind: string }) => {
    const common = { fill: 'none', stroke: C, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
    switch (kind) {
        case 'up': return <svg viewBox='0 0 22 22'><path {...common} d='M3 17 L11 9 L14 12 L19 6 M14 6 H19 V11' /></svg>;
        case 'down': return <svg viewBox='0 0 22 22'><path {...common} d='M3 6 L11 14 L14 11 L19 17 M14 17 H19 V12' /></svg>;
        case 'touch': return <svg viewBox='0 0 22 22'><path {...common} d='M3 17 L11 9 L14 12 L19 6' /><circle cx='19' cy='6' r='2' fill={C} /></svg>;
        case 'notouch': return <svg viewBox='0 0 22 22'><path {...common} d='M3 17 L11 9 L14 12 L19 8' /><path {...common} d='M16 16 l4 4 M20 16 l-4 4' /></svg>;
        case 'squares': return <svg viewBox='0 0 22 22'><g fill={C}><rect x='3' y='3' width='6' height='6' rx='1' /><rect x='12' y='3' width='6' height='6' rx='1' /><rect x='3' y='12' width='6' height='6' rx='1' /><rect x='12' y='12' width='6' height='6' rx='1' /></g></svg>;
        case 'tri': return <svg viewBox='0 0 22 22'><path fill={C} d='M11 3 L19 17 H3 Z' /></svg>;
        case 'burst': return <svg viewBox='0 0 22 22'><path {...common} d='M11 2 V8 M11 14 V20 M2 11 H8 M14 11 H20 M5 5 L9 9 M13 13 L17 17 M17 5 L13 9 M9 13 L5 17' /></svg>;
        case 'cross': return <svg viewBox='0 0 22 22'><path {...common} d='M3 4 L19 18 M3 18 L19 4 M15 4 H19 V8 M15 18 H19 V14' /></svg>;
        case 'wave': return <svg viewBox='0 0 22 22'><path {...common} d='M2 14 L6 10 L9 13 L13 7 L16 10 L20 5' /></svg>;
        default: return null;
    }
};

const KINDS: Record<string, string[]> = {
    accumulators: ['wave'], matchesdiffers: ['burst', 'burst'], evenodd: ['squares', 'tri'], overunder: ['up', 'down'],
    risefall: ['up', 'down'], higherlower: ['up', 'down'], touchnotouch: ['touch', 'notouch'], multipliers: ['cross'],
    turbos: ['wave', 'wave'], vanillas: ['up', 'down'],
};
export const TypeIcon = ({ id }: { id: string }) => <span className='dt-icon'>{(KINDS[id] ?? ['up']).map((k, i) => <Glyph key={i} kind={k} />)}</span>;
export const SideGlyph = ({ id, tone }: { id: string; tone: 'up' | 'down' }) => {
    const k = KINDS[id] ?? ['up'];
    return <span className='dt-glyph' style={{ filter: 'brightness(0) invert(1)' }}><Glyph kind={k.length > 1 ? k[tone === 'up' ? 0 : 1] : k[0]} /></span>;
};
