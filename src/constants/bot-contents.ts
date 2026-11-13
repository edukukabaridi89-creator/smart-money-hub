type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    FREE_BOTS: 3,
    PREMIUM_BOTS: 4,
    BOT_STUDIO: 5,
    MY_BOTS: 6,
    DCIRCLES: 7,
    SIGNALS: 8,
    HEDGE_HUB: 9,
    BULK_TRADER: 10,
    MANUAL_TRADER: 11,
    TRADINGVIEW: 12,
    AUTO_TRADER: 13,
    COPY_TRADING: 14,
    RISK_CALC: 15,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-free-bots',
    'id-premium-bots',
    'id-bot-studio',
    'id-my-bots',
    'id-dcircles',
    'id-signals',
    'id-hedge-hub',
    'id-bulk-trader',
    'id-manual-trader',
    'id-tradingview',
    'id-auto-trader',
    'id-copy-trading',
    'id-risk-calc',
];

export const DEBOUNCE_INTERVAL_TIME = 500;
