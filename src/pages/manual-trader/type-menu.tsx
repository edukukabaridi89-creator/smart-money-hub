// @ts-nocheck
import React, { useState } from 'react';
import { GROUPS, type TradeTypeDef } from '@/nexus/dtrader/trade-types';
import { TypeIcon } from './icons';

const CATEGORIES = ['All', 'Multipliers', 'Options', 'Accumulators'] as const;

/** The "Trade types" popup: categories on the left, grouped list with search on the right. */
export const TypeMenu = ({ types, current, onPick, onClose }: { types: TradeTypeDef[]; current: string; onPick: (id: string) => void; onClose: () => void }) => {
    const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('All');
    const [q, setQ] = useState('');
    const shown = types.filter(t => (cat === 'All' || t.category === cat) && t.label.toLowerCase().includes(q.trim().toLowerCase()));
    return (
        <>
            <div className='dt-scrim' onClick={onClose} />
            <div className='dt-menu' role='dialog' aria-label='Trade types'>
                <div className='dt-menu__cats'>
                    <h4>Trade types</h4>
                    {CATEGORIES.map(c => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
                </div>
                <div className='dt-menu__list'>
                    <input autoFocus placeholder='Search' value={q} onChange={e => setQ(e.target.value)} aria-label='Search trade types' />
                    {GROUPS.map(g => {
                        const items = shown.filter(t => t.group === g);
                        return items.length ? (
                            <div key={g} className='dt-menu__group'>
                                <h5>{g}</h5>
                                {items.map(t => (
                                    <button key={t.id} className={t.id === current ? 'on' : ''} onClick={() => (onPick(t.id), onClose())}>
                                        <TypeIcon id={t.id} />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : null;
                    })}
                    {!shown.length && <p className='dt-menu__empty'>No trade types match.</p>}
                </div>
            </div>
        </>
    );
};
