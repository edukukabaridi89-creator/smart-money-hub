import { openXmlInBotBuilder } from '@/nexus/open-bot';

/**
 * PREMIUM BOTS: add or edit bots here. Each needs a title, a short description (`about`; keep it free of specific markets,
 * they can be changed once the bot is open), a few feature tags and an XML file in ./bots. The banner text and badge wording
 * ("free for a few days") are PREMIUM_NOTICE / PREMIUM_BADGE in src/nexus/config.ts.
 * `art` picks the thumbnail layout: scan, rotate, overunder, evenodd, quad.
 */
export type PremiumArt = 'scan' | 'rotate' | 'overunder' | 'evenodd' | 'quad';
const SOURCES: { title: string; about: string; tags: string[]; art: PremiumArt; load: () => Promise<{ default: string }> }[] = [
    {
        title: 'Even Odd Money Scanner',
        about: 'Scans the markets and buys Even only when one shows a strong Even run in its recent ticks. The stake grows after a loss and drops back after a win; take profit and stop loss are set at the top.',
        tags: ['Even', 'Market scanner', 'Martingale'],
        art: 'scan',
        load: () => import('./bots/even-odd-auto-scanner.xml'),
    },
    {
        title: 'SmartScript',
        about: 'Moves to the next market on every trade and buys Over 1. The stake is multiplied after a loss and returns to the starting stake after a win. It keeps going until you stop it.',
        tags: ['Over 1', 'Market rotation', 'Martingale'],
        art: 'rotate',
        load: () => import('./bots/tradescript.xml'),
    },
    {
        title: 'The Hub Digit Switcher',
        about: 'Alternates between Over and Under on every trade, with a martingale of 2. Turn on "Scan All Markets" in the first block and it also moves to the market where the next side has been appearing most.',
        tags: ['Over ⇄ Under', 'Martingale ×2', 'Scan all markets'],
        art: 'overunder',
        load: () => import('./bots/alpha-digit-switcher.xml'),
    },
    {
        title: 'The Hub 2 Digit Switcher (V2)',
        about: 'Alternates between Even and Odd on every trade, with a martingale of 2. Has the same "Scan All Markets" switch in the first block.',
        tags: ['Even ⇄ Odd', 'Martingale ×2', 'Scan all markets'],
        art: 'evenodd',
        load: () => import('./bots/alpha-2-digit-switcher.xml'),
    },
    {
        title: 'The Hub 3 Digit Switcher',
        about: 'Before each trade it compares Even, Odd, Over and Under over the last 100 ticks and buys the one that has appeared most. Martingale of 2 and an optional "Scan All Markets" switch.',
        tags: ['Even · Odd · Over · Under', 'By probability', 'Scan all markets'],
        art: 'quad',
        load: () => import('./bots/alpha-3-digit-switcher.xml'),
    },
];

export const PREMIUM_BOTS = SOURCES.map((s, i) => ({ n: i + 1, ...s }));
export type PremiumBot = (typeof PREMIUM_BOTS)[number];

export const openPremiumBot = async (bot: PremiumBot): Promise<boolean> => openXmlInBotBuilder((await bot.load()).default, bot.title);
