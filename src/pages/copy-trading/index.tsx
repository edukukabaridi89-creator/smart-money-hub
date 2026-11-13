// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { TOKEN_URL } from '@/nexus/config';
import { nexus } from '@/nexus/store';
import { Panel } from '@/nexus/ui';

const money = (n, c) => `${Number(n ?? 0).toFixed(2)} ${c ?? ''}`;

export const CopyTrading = observer(() => {
    const [tok, setTok] = useState('');
    const type = nexus.masterType();
    const client = nexus.root?.client;
    const targets = nexus.copyTargets.length;
    return (
        <Panel title='Copy Trading Console'>
            <div className='nx-muted'>
                Logged-in account: <b>{client?.loginid ?? 'not logged in'}</b> ({type.toUpperCase()}
                {client?.balance !== undefined ? `, ${money(client.balance, client.currency)}` : ''}). Every trade you place here, including bots, is copied to your followers' <b>{type}</b> accounts.
            </div>
            <div className='nx-row'>
                <input className='nx-input' placeholder='Paste follower API token (needs the Trade scope)' value={tok} onChange={e => setTok(e.target.value)} />
                <button className='nx-btn nx-btn--go' onClick={() => (nexus.addToken(tok), setTok(''))}>Add</button>
            </div>
            <div className='nx-row'>
                <button className='nx-btn nx-btn--go' onClick={nexus.startCopy}>Start Copy Trading</button>
                <button className='nx-btn' onClick={nexus.pauseAll}>Pause All</button>
                <button className='nx-btn' onClick={nexus.resumeAll}>Resume All</button>
                <button className='nx-btn' onClick={nexus.refreshAll}>Refresh balances</button>
                <a className='nx-btn nx-btn--link' href={TOKEN_URL} target='_blank' rel='noreferrer'>Create Copytrading Token Now</a>
            </div>
            <div className='nx-muted'>
                {nexus.copyRunning ? (nexus.copyPaused ? 'Paused' : `Copying to ${targets} ${type} account${targets === 1 ? '' : 's'}`) : 'Stopped'}
                {nexus.copyRunning && !nexus.copyPaused && targets === 0 ? ` — no follower has a ${type} account, so nothing is copied.` : ''}
            </div>
            <div className='nx-grid'>
                {nexus.tokens.map(t => (
                    <Panel key={t.token} className='nx-token'>
                        <b>…{t.token.slice(-4)}</b>
                        <span className={t.status === 'error' ? 'down' : 'up'}>{t.status === 'ready' ? 'Connected' : t.status === 'error' ? t.error : 'Connecting…'}</span>
                        {t.accounts.map(a => (
                            <div key={a.account_id} className='nx-row'>
                                <span>{a.account_id} <small className='nx-muted'>{a.account_type}</small></span>
                                <span className='up'>{money(a.balance, a.currency)}</span>
                                <small className='nx-muted'>{a.account_type === type ? 'copies now' : `waits for a ${a.account_type} master`}</small>
                            </div>
                        ))}
                        <small className='nx-muted'>Copied {t.copied} · Failed {t.failed}{t.lastResult ? ` · ${t.lastResult}` : ''}</small>
                        <button className='nx-btn nx-btn--stop' onClick={() => nexus.removeToken(t.token)}>Remove Token</button>
                    </Panel>
                ))}
            </div>
        </Panel>
    );
});
