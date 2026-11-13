// @ts-nocheck
import React, { useState } from 'react';
import { HubBanner } from '@/nexus/hub-banner';
import { Panel } from '@/nexus/ui';
import { FREE_BOTS, openBot } from './bots';

const KIND = { Over: 'over', Under: 'under', Even: 'even', Odd: 'odd', Rise: 'rise', Fall: 'fall' };

export const FreeBots = () => {
    const [opening, setOpening] = useState<number | null>(null);
    const open = async b => {
        setOpening(b.n);
        await openBot(b);
        setOpening(null);
    };
    return (
        <>
            <div className='nx-grid nx-grid--bots'>
                {FREE_BOTS.map(b => (
                    <Panel key={b.n} className='nx-bot'>
                        <div className='nx-bot__banner'>
                            <HubBanner seed={b.n * 7 + 3} accent={b.tier.c1} kind={KIND[b.types[0]] ?? 'over'} />
                            <span className='nx-bot__chip'>#{String(b.n).padStart(2, '0')} · OVER / UNDER</span>
                        </div>
                        <div className='nx-bot__body'>
                            <span className='nx-bot__open'>OPEN ACCESS</span>
                            <h4>{b.title}</h4>
                            <p className='nx-muted nx-bot__about'>{b.about}</p>
                            <div className='nx-tags'>
                                <span className='nx-tag'>Over/Under</span>
                                {b.types.map(t => <span key={t} className='nx-tag nx-tag--alt'>{t}</span>)}
                            </div>
                            <span className='nx-tier' style={{ color: b.tier.c1 }}>{b.tier.name} · power {b.power}</span>
                            <div className='nx-pbar' style={{ '--accent': b.tier.c1 }}><i style={{ width: `${b.power}%` }} /></div>
                        </div>
                        <button className='nx-btn nx-bot__btn' style={{ background: `linear-gradient(135deg, ${b.tier.c1}, ${b.tier.c2})`, color: '#0b1230' }} disabled={opening !== null} onClick={() => open(b)}>{opening === b.n ? 'Opening…' : 'Open Bot'}</button>
                    </Panel>
                ))}
            </div>
            <p className='nx-muted nx-note'>Power index reflects strategy depth, stake-scaling and digit-statistics logic in each bot, not expected profit. Stake, market and limits can all be changed once the bot is open. Every bot can lose money; test on a demo account first.</p>
        </>
    );
};
