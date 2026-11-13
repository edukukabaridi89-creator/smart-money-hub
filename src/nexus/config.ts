// ============================ TEMPLATE SETTINGS ============================
// ONE place to edit for a new client: name, logo, colours, social links, app ID.
// Every value below can ALSO be set per deployment with an environment variable (Vercel > Settings > Environment Variables),
// so one code base serves every client with no code edits. A variable that is empty or missing uses the default written here;
// for the social links, set the variable to `none` to hide that icon. See DEPLOY.md for the full list.
const env = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const link = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim().toLowerCase() === 'none' ? '' : env(v, fallback));
export const APP_NAME = env(process.env.NEXT_PUBLIC_DERIV_APP_NAME, 'Smart Money Hub'); // splash screen name + browser tab title
export const TAGLINE = env(process.env.NEXT_PUBLIC_TAGLINE, 'Trade Smart. Grow Steady.'); // line under the name on the splash screen

/** Blue typed greeting shown right after the splash. Set NEXT_PUBLIC_WELCOME_MESSAGE to change it, or to `none` to turn it off. */
export const WELCOME_MESSAGE = link(process.env.NEXT_PUBLIC_WELCOME_MESSAGE, 'Stay disciplined, trader. Smart money is patient money. Wishing you a great session today! 💙');

/** Header logo. The header shows only the logo (no name text) unless SHOW_NAME_IN_HEADER is true. */
export const LOGO_URL = link(process.env.NEXT_PUBLIC_LOGO_URL, '/logo.svg'); // file in /public (swap it for the client's logo); '' = letter badge from APP_NAME
export const SHOW_NAME_IN_HEADER = env(process.env.NEXT_PUBLIC_SHOW_NAME_IN_HEADER, 'false') === 'true';

/** Premium Bots tab: the banner text shown above the bots and the badge on each card. Edit the wording here (or set the env variables). */
export const PREMIUM_NOTICE = env(process.env.NEXT_PUBLIC_PREMIUM_NOTICE, 'These premium bots are free for a few days only. Open and run them while the offer lasts.');
export const PREMIUM_BADGE = env(process.env.NEXT_PUBLIC_PREMIUM_BADGE, 'FREE FOR A FEW DAYS');

/** Demo limit: after this many trades on a demo account the demo is locked for DEMO_LIMIT_HOURS. Set NEXT_PUBLIC_DEMO_LIMIT_TRADES to `none` (or 0) to turn it off. */
const num = (v: unknown, d: number) => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) && n >= 0 ? n : d; };
export const DEMO_LIMIT_TRADES = String(process.env.NEXT_PUBLIC_DEMO_LIMIT_TRADES || '').trim().toLowerCase() === 'none' ? 0 : num(process.env.NEXT_PUBLIC_DEMO_LIMIT_TRADES, 6);
export const DEMO_LIMIT_HOURS = num(process.env.NEXT_PUBLIC_DEMO_LIMIT_HOURS, 5);
/** Demo accounts that are never limited (the owner's own). Comma separated, set NEXT_PUBLIC_DEMO_LIMIT_EXEMPT to replace the default. */
export const DEMO_LIMIT_EXEMPT = String(process.env.NEXT_PUBLIC_DEMO_LIMIT_EXEMPT ?? 'DOT93156605,DOT90326984').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

/** Theme colours (any CSS colour). */
export const THEME = {
    primary: env(process.env.NEXT_PUBLIC_THEME_PRIMARY, '#2f6bff'), // main brand colour: buttons, active tab, NEW badge. Leave '' to use colors.primary from brand.config.json
    up: env(process.env.NEXT_PUBLIC_THEME_UP, '#4bb4b3'), // buy / rise / even buttons
    down: env(process.env.NEXT_PUBLIC_THEME_DOWN, '#ec3f3f'), // sell / fall / odd buttons
    glowA: env(process.env.NEXT_PUBLIC_THEME_GLOW_A, '#7fb0ff'), // splash screen: glow colour 1 (title, particles)
    glowB: env(process.env.NEXT_PUBLIC_THEME_GLOW_B, '#38d5ff'), // splash screen: glow colour 2
    lightning: env(process.env.NEXT_PUBLIC_THEME_LIGHTNING, '#d6f3ff'), // splash screen: lightning
    splashFrom: '#0a2a6b', // splash screen background: centre
    splashTo: '#050914', // splash screen background: edge
    tab: env(process.env.NEXT_PUBLIC_THEME_TAB, '#2f6bff'), // page tabs (Free Bots, Manual Trader...): the oval colour. Active tab is solid, others are a soft tint of it
    tabText: env(process.env.NEXT_PUBLIC_THEME_TAB_TEXT, '#ffffff'), // text on the active tab
};

/** "Follow us" icons in the header. Put your links here; an empty link hides that icon. */
export const SOCIAL_LINKS = {
    telegram: link(process.env.NEXT_PUBLIC_TELEGRAM_URL, ''),
    whatsapp: link(process.env.NEXT_PUBLIC_WHATSAPP_URL, 'https://wa.me/message/EUWZAY7UQLZ5D1'),
    tiktok: link(process.env.NEXT_PUBLIC_TIKTOK_URL, ''),
};
// ============================================================================

export const APP_ID = (process.env.NEXT_PUBLIC_DERIV_APP_ID as string) || '1089';
/** Legacy endpoint from the original spec; used only as a fallback when the app's own public WebSocket fails. */
export const LEGACY_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;
export const TOKEN_URL = 'https://home.deriv.com/dashboard/profile/api-tokens?';
export const CHARTS_URL = 'https://charts.deriv.com/deriv';

const vol = (n: number, one_sec = false) => ({ id: one_sec ? `1HZ${n}V` : `R_${n}`, name: `Volatility ${n}${one_sec ? ' (1s)' : ''}` });
export const SYMBOLS: { id: string; name: string }[] = [
    vol(10), vol(25), vol(50), vol(75), vol(100),
    vol(10, true), vol(15, true), vol(25, true), vol(30, true), vol(50, true), vol(75, true), vol(90, true), vol(100, true),
];
export const symbolName = (id: string) => SYMBOLS.find(s => s.id === id)?.name ?? id;

