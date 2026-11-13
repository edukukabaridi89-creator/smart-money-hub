// @ts-nocheck
import React, { useState } from 'react';
import { PREMIUM_BADGE, PREMIUM_NOTICE } from '@/nexus/config';
import { PremiumBanner } from '@/nexus/premium-banner';
import { Panel } from '@/nexus/ui';
import { openPremiumBot, PREMIUM_BOTS } from './bots';

export const PremiumBots = () => {
    const [opening, setOpening] = useState<number | null>(null);
    const open = async b => {
        setOpening(b.n);
        await openPremiumBot(b);
        setOpening(null);
    };
    return (
        <>
            <div className='nx-premium-note'><b>{PREMIUM_BADGE}</b><span>{PREMIUM_NOTICE}</span></div>
            <div className='nx-grid nx-grid--bots'>
                {PREMIUM_BOTS.map(b => (
                    <Panel key={b.n} className='nx-bot nx-bot--premium'>
                        <div className='nx-bot__banner'>
                            <PremiumBanner art={b.art} seed={b.n} />
                            <span className='nx-bot__chip nx-bot__chip--gold'>PREMIUM</span>
                        </div>
                        <div className='nx-bot__body'>
                            <span className='nx-bot__open nx-bot__open--gold'>{PREMIUM_BADGE}</span>
                            <h4>{b.title}</h4>
                            <p className='nx-muted nx-bot__about'>{b.about}</p>
                            <div className='nx-tags'>{b.tags.map(t => <span key={t} className='nx-tag nx-tag--alt'>{t}</span>)}</div>
                        </div>
                        <button className='nx-btn nx-bot__btn nx-bot__btn--gold' disabled={opening !== null} onClick={() => open(b)}>{opening === b.n ? 'Opening…' : 'Open Bot'}</button>
                    </Panel>
                ))}
            </div>
            <p className='nx-muted nx-note'>Premium bots are offered free for a limited time. Stake, market, take profit and stop loss can all be changed once a bot is open. Every bot can lose money; test on a demo account first.</p>
        </>
    );
};
