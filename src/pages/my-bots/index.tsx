// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { myBots, type SavedBot } from '@/nexus/my-bots';
import { currentWorkspaceXml, openXmlInBotBuilder } from '@/nexus/open-bot';
import { nexus } from '@/nexus/store';
import { describe } from '@/nexus/studio/bot-spec';
import '@/nexus/studio/studio.scss';

export const MyBots = observer(() => {
    const [opening, setOpening] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<string | null>(null);
    const [name, setName] = useState('');
    const open = async (b: SavedBot) => {
        setOpening(b.id);
        try {
            await openXmlInBotBuilder(await myBots.xmlOf(b), b.name);
        } catch (e) {
            console.error(e);
            nexus.log(`Could not open "${b.name}".`);
        }
        setOpening(null);
    };
    const saveCurrent = () => {
        const xml = currentWorkspaceXml();
        if (!xml) return nexus.log('Bot Builder is empty. Open or build a bot there first.');
        const saved = myBots.add({ name: name.trim() || `Saved ${new Date().toLocaleDateString()}`, source: 'workspace', xml });
        if (!saved) return nexus.log('Your browser has no room left to store this. Delete a bot and try again.');
        setName('');
    };
    return (
        <>
            <div className='studio__head'>
                <h2>My Bots</h2>
                <p>Bots you made in Bot Studio or saved from Bot Builder. They are stored in this browser only.</p>
            </div>
            <div className='studio__save'>
                <input value={name} onChange={e => setName(e.target.value)} placeholder='Name for the strategy open in Bot Builder' maxLength={40} aria-label='Name' />
                <button className='studio__btn' onClick={saveCurrent}>Save what's open in Bot Builder</button>
            </div>
            {myBots.bots.length === 0 ? (
                <div className='studio__empty'>
                    <p>No bots yet.</p>
                    <button className='studio__btn studio__btn--primary' onClick={() => nexus.goTab(DBOT_TABS.BOT_STUDIO)}>Describe one in Bot Studio</button>
                </div>
            ) : (
                <div className='studio__cards'>
                    {myBots.bots.map(b => (
                        <article key={b.id} className='studio__card'>
                            <h4>{b.name}</h4>
                            <p>{b.spec ? describe(b.spec) : 'Saved from Bot Builder'}</p>
                            <small>{new Date(b.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                            <div className='studio__row'>
                                <button className='studio__btn studio__btn--primary' disabled={opening !== null} onClick={() => open(b)}>{opening === b.id ? 'Opening…' : 'Open in Bot Builder'}</button>
                                {confirm === b.id ? (
                                    <>
                                        <button className='studio__btn studio__btn--danger' onClick={() => (myBots.remove(b.id), setConfirm(null))}>Delete</button>
                                        <button className='studio__btn' onClick={() => setConfirm(null)}>Keep</button>
                                    </>
                                ) : (
                                    <button className='studio__btn' onClick={() => setConfirm(b.id)}>Delete</button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </>
    );
});
