// @ts-nocheck
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { storeAuthInfo, clearAllAuthData } from '@/external/deriv-core';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { APP_ID, TOKEN_URL } from './config';
import brandConfig from '../../brand.config.json';
import { isProduction } from '@/components/shared';

/**
 * Log in with a Deriv API token (personal access token, Trade scope) instead of the Deriv login page. Useful for people who only
 * have a token, or whose account is managed by someone else. The token is checked against Deriv, saved as the session
 * (token_type 'pat'), and the app reloads and continues exactly as after a normal login. Logging out clears it.
 */
export const loginWithToken = async (raw: string): Promise<string | null> => {
    const token = raw.trim();
    if (!token) return 'Paste your API token first.';
    try {
        const base = brandConfig.platform.derivws.url[isProduction() ? 'production' : 'staging'];
        const res = await fetch(`${base}${brandConfig.platform.derivws.directories.options}accounts`, { headers: { Authorization: `Bearer ${token}`, 'Deriv-App-ID': APP_ID } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return body?.errors?.[0]?.message || body?.error?.message || body?.message || `Deriv did not accept this token (${res.status}).`;
        const accounts = body?.data ?? [];
        if (!accounts.length) return 'This token has no options accounts.';
        clearAllAuthData();
        sessionStorage.clear();
        const far = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;
        storeAuthInfo({ access_token: token, token_type: 'pat', expires_in: 31536000, expires_at: far, scope: 'trade', refresh_token: '' });
        DerivWSAccountsService.storeAccounts(accounts);
        localStorage.setItem('active_loginid', accounts[0].account_id);
        localStorage.setItem('account_type', accounts[0].account_type === 'demo' ? 'demo' : 'real');
        window.location.reload();
        return null;
    } catch (e) {
        return `Could not reach Deriv: ${String(e?.message || e)}`;
    }
};

export const TokenLoginModal = ({ onClose }: { onClose: () => void }) => {
    const [tok, setTok] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        setErr('');
        const e = await loginWithToken(tok);
        if (e) { setErr(e); setBusy(false); }
    };
    return createPortal(
        <div className='nx-modal' role='dialog' aria-modal='true' onClick={onClose}>
            <div className='nx-modal__card' onClick={e => e.stopPropagation()}>
                <h3>Log in with API token</h3>
                <p className='nx-muted'>Use a Deriv API token with the <b>Trade</b> scope. It works for demo and real accounts, and for accounts someone manages for you. Keep it private: anyone with it can trade that account.</p>
                <input className='nx-input' type='password' autoFocus placeholder='Paste your API token' value={tok} onChange={e => setTok(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
                {err && <p className='down nx-modal__err'>{err}</p>}
                <div className='nx-row'>
                    <button className='nx-btn nx-btn--go' disabled={busy} onClick={submit}>{busy ? 'Checking…' : 'Log in'}</button>
                    <button className='nx-btn' onClick={onClose}>Cancel</button>
                    <a className='nx-btn nx-btn--link' href={TOKEN_URL} target='_blank' rel='noreferrer'>Get a token</a>
                </div>
            </div>
        </div>,
        document.body
    );
};
