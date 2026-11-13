// @ts-nocheck
import React, { lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { useDevice } from '@deriv-com/ui';
import { useStore } from '@/hooks/useStore';
import { nexus } from './store';
import './nexus.scss';

// Pages load on demand (one download per page), so the first screen stays small and fast.
const page = (load: () => Promise<any>, name: string) => lazy(() => load().then(m => ({ default: m[name] })));
export const FreeBots = page(() => import('@/pages/free-bots'), 'FreeBots');
export const PremiumBots = page(() => import('@/pages/premium-bots'), 'PremiumBots');
export const BotStudio = page(() => import('@/pages/bot-studio'), 'BotStudio');
export const MyBots = page(() => import('@/pages/my-bots'), 'MyBots');
export const DCircles = page(() => import('@/pages/dcircles'), 'DCircles');
export const Signals = page(() => import('@/pages/signals'), 'Signals');
export const HedgeHub = page(() => import('@/pages/hedge-hub'), 'HedgeHub');
export const BulkTrader = page(() => import('@/pages/bulk-trader'), 'BulkTrader');
export const ManualTrader = page(() => import('@/pages/manual-trader'), 'ManualTrader');
export const TradingView = page(() => import('@/pages/tradingview'), 'TradingView');
export const AutoTraderPage = page(() => import('@/pages/auto-trader'), 'AutoTraderPage');
export const CopyTrading = page(() => import('@/pages/copy-trading'), 'CopyTrading');
export const RiskCalculatorPage = page(() => import('@/pages/risk-calculator'), 'RiskCalculator');

const Loading = <div className='nx-loading'>Loading…</div>;

/** Fills the whole area under the tab row (tabs and URL bar stay visible); makes room when the run panel is open. */
export const NexusPage = observer(({ children }: { children: React.ReactNode }) => {
    const { run_panel } = useStore();
    const { isDesktop } = useDevice();
    return (
        <div className={`nx nx-wrap ${run_panel.is_drawer_open && isDesktop ? 'nx-wrap--expanded' : ''}`}>
            {nexus.notice && <div className='nx-notice'>{nexus.notice}</div>}
            <Suspense fallback={Loading}>{children}</Suspense>
        </div>
    );
});

/** Container for Bot Studio / My Bots: plain page that follows the app theme (the other added tabs keep their own look). */
export const StudioPage = observer(({ children }: { children: React.ReactNode }) => {
    const { run_panel } = useStore();
    const { isDesktop } = useDevice();
    return (
        <div className={`studio ${run_panel.is_drawer_open && isDesktop ? 'studio--expanded' : ''}`}>
            {nexus.notice && <div className='nx-notice'>{nexus.notice}</div>}
            <Suspense fallback={Loading}>{children}</Suspense>
        </div>
    );
});

/** Container for the DTrader-style Manual Trader: chart | trade panel. */
export const TraderPage = observer(({ children }: { children: React.ReactNode }) => {
    const { run_panel } = useStore();
    const { isDesktop } = useDevice();
    return <div className={`dt ${run_panel.is_drawer_open && isDesktop ? 'dt--expanded' : ''}`}><Suspense fallback={Loading}>{children}</Suspense></div>;
});
