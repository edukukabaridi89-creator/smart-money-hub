// @ts-nocheck
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { generateOAuthURL } from '@/components/shared';
import { APP_NAME, LOGO_URL, TAGLINE } from './config';
import { TokenLoginModal } from './token-login';

/** Shown right after the splash to visitors who are not logged in: log in, sign up, or log in with a token. */
const needsGate = () => {
    if (String(process.env.NEXT_PUBLIC_ENTRY_SCREEN || '').trim().toLowerCase() === 'none') return false;
    try { if (localStorage.getItem('active_loginid')) return false; } catch (e) {}
    const q = window.location.search;
    if (/[?&](code|state|error|token1|acct1)=/.test(q)) return false; // coming back from Deriv login
    return true;
};

const Gate = () => {
    const [token, setToken] = useState(false);
    const [busy, setBusy] = useState(false);
    const go = async (mode?: 'registration') => {
        setBusy(true);
        try {
            const url = await generateOAuthURL(mode);
            if (url) return void window.location.replace(url);
        } catch (e) {}
        setBusy(false);
    };
    return (
        <div className='nx-gate' role='dialog' aria-modal='true' aria-label={`Welcome to ${APP_NAME}`}>
            <div className='nx-gate__card'>
                {LOGO_URL && <img className='nx-gate__logo' src={LOGO_URL} alt='' />}
                <h2>{APP_NAME}</h2>
                {TAGLINE && <p className='nx-gate__tag'>{TAGLINE}</p>}
                <button className='nx-gate__btn nx-gate__btn--main' disabled={busy} onClick={() => go()}>Log in</button>
                <button className='nx-gate__btn nx-gate__btn--alt' disabled={busy} onClick={() => go('registration')}>Sign up</button>
                <button className='nx-gate__btn' onClick={() => setToken(true)}>Log in with token</button>
            </div>
            {token && <TokenLoginModal onClose={() => setToken(false)} />}
        </div>
    );
};

export const mountEntryGate = (onClose: () => void) => {
    if (!needsGate()) return onClose();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = ReactDOM.createRoot(el);
    root.render(<Gate />);
};
