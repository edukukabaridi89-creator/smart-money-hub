// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { helloSeen, markHelloSeen } from './hello-key';
import { nexus } from './store';

const hi = (h: number) => (h >= 5 && h < 12 ? 'good morning' : h >= 12 && h < 17 ? 'good afternoon' : h >= 17 && h < 21 ? 'good evening' : 'good night');

/** One-time pop-up after login: greets the trader by their real account ID (ROT…) and offers the Risk Calculator. */
export const GreetingPopup = observer(() => {
    const { client } = useStore();
    const [done, setDone] = useState(false);
    const accounts = DerivWSAccountsService.getStoredAccounts() || [];
    const active = client?.loginid || (typeof localStorage !== 'undefined' && localStorage.getItem('active_loginid')) || '';
    const real: any = accounts.find((a: any) => a.account_type === 'real');
    const clean = (v: any) => (v && v !== 'undefined' && v !== 'null' ? String(v) : '');
    const id = clean(real?.account_id || real?.loginid) || clean(active);
    const [now, setNow] = useState(new Date());
    useEffect(() => { setNow(new Date()); }, [client?.is_logged_in]);
    if (done || !client?.is_logged_in || !id || helloSeen()) return null;
    const close = (go: boolean) => {
        markHelloSeen();
        setDone(true);
        if (go) nexus.goTab(DBOT_TABS.RISK_CALC);
    };
    return (
        <div className='nx-hello__backdrop' role='dialog' aria-modal='true' aria-label='Welcome'>
            <div className='nx-hello'>
                <h3>Hello {id}, {hi(now.getHours())}.</h3>
                <p>Good luck on your trades today.</p>
                <div className='nx-hello__row'>
                    <button className='nx-hello__btn nx-hello__btn--main' onClick={() => close(true)}>Go to risk calculator</button>
                    <button className='nx-hello__btn' onClick={() => close(false)}>Not now</button>
                </div>
            </div>
        </div>
    );
});
