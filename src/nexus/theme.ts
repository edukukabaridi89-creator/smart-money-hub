import { applyPrimaryColor } from '@/utils/apply-branding';
import { THEME } from './config';

/** Pushes the THEME colours from config.ts into CSS variables. Runs once at startup, before the splash screen draws. */
export const applyTheme = () => {
    const root = document.documentElement.style;
    root.setProperty('--nx-theme-up', THEME.up);
    root.setProperty('--nx-theme-down', THEME.down);
    root.setProperty('--nx-glow-a', THEME.glowA);
    root.setProperty('--nx-glow-b', THEME.glowB);
    root.setProperty('--nx-bolt', THEME.lightning);
    root.setProperty('--nx-splash-from', THEME.splashFrom);
    root.setProperty('--nx-splash-to', THEME.splashTo);
    root.setProperty('--nx-tab', THEME.tab);
    root.setProperty('--nx-tab-text', THEME.tabText);
    if (THEME.primary) applyPrimaryColor(THEME.primary); // same variables brand.config.json colors.primary drives
};
