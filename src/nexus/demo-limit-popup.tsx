// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { observer } from 'mobx-react-lite';
import { generateOAuthURL } from '@/components/shared';
import { useStore } from '@/hooks/useStore';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { DEMO_LIMIT_HOURS, DEMO_LIMIT_TRADES } from './config';
import { closeDemoLimit, formatLeft, isDemoLimitOpen, lockRemaining, setBotStopper, startDemoLimit, subscribeDemoLimit } from './demo-limit';

const realAccountId = (): string => {
    try {
        const a = (DerivWSAccountsService.getStoredAccounts() || []).find((x: any) => x.account_type === 'real' || (x.account_id && !/^(VR|DEM|DOT)/i.test(x.account_id)));
        if (a) return a.account_id || a.loginid;
        const list = JSON.parse(localStorage.getItem('client_account_details') || '[]');
        return list.find((x: any) => x.loginid && !/^(VR|DEM|DOT)/i.test(x.loginid))?.loginid || '';
    } catch (e) { return ''; }
};

/** "Demo limit reached" pop-up: opens after the demo trades are used up, and again whenever someone tries to Run on the locked demo. */
export const DemoLimitPopup = observer(() => {
    const { run_panel } = useStore();
    const [, tick] = useState(0);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        startDemoLimit();
        setBotStopper(() => run_panel?.stopBot?.());
        const un = subscribeDemoLimit(() => tick(n => n + 1));
        const t = setInterval(() => tick(n => n + 1), 30000);
        return () => { un(); clearInterval(t); setBotStopper(null); };
    }, [run_panel]);
    if (!isDemoLimitOpen()) return null;
    const left = lockRemaining();
    const toReal = async () => {
        const id = realAccountId();
        if (id) {
            localStorage.setItem('active_loginid', id);
            localStorage.setItem('account_type', 'real');
            window.location.reload();
            return;
        }
        setBusy(true); // this login has no real account: open Deriv sign-up (uses the referral)
        try { const url = await generateOAuthURL('registration'); if (url) return void window.location.replace(url); } catch (e) {}
        setBusy(false);
    };
    return createPortal(
        <div className='nx-dl__backdrop' role='dialog' aria-modal='true' aria-label='Demo limit reached'>
            <div className='nx-dl'>
                <div className='nx-dl__icon' aria-hidden='true'>⏳</div>
                <h3>Your demo limit is reached</h3>
                <p>You have used your {DEMO_LIMIT_TRADES} demo trades.{left > 0 ? <> It resets in <b>{formatLeft(left)}</b>.</> : <> It resets in {DEMO_LIMIT_HOURS} hours.</>}</p>
                <div className='nx-dl__row'>
                    <button className='nx-dl__btn nx-dl__btn--main' disabled={busy} onClick={toReal}>Switch to real</button>
                    <button className='nx-dl__btn' onClick={closeDemoLimit}>Not now</button>
                </div>
            </div>
        </div>,
        document.body
    );
});
