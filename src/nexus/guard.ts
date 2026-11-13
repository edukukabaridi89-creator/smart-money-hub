// @ts-nocheck
/**
 * Deterrent against casual inspection: blocks the right-click menu and the usual DevTools / view-source / save shortcuts,
 * and covers the app while DevTools is open. This makes copying harder; it cannot make code that runs in a browser secret.
 * Set NEXT_PUBLIC_ALLOW_INSPECT=1 (e.g. in a local .env) to switch it off while developing.
 */
const ALLOW = String(process.env.NEXT_PUBLIC_ALLOW_INSPECT || '') === '1';

export const startGuard = () => {
    if (ALLOW || window.__nxGuard) return;
    window.__nxGuard = true;
    const stop = (e: Event) => (e.preventDefault(), e.stopPropagation(), false);

    document.addEventListener('contextmenu', stop, true);
    document.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            const k = (e.key || '').toLowerCase();
            const mod = e.ctrlKey || e.metaKey;
            if (e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || (mod && ['u', 's'].includes(k)) || (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k))) stop(e);
        },
        true
    );

    let cover: HTMLDivElement | null = null;
    const show = (on: boolean) => {
        if (on && !cover) {
            cover = document.createElement('div');
            cover.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;background:#0b0f1a;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;font:600 18px system-ui,sans-serif;padding:24px');
            cover.textContent = 'Developer tools are not allowed here. Close them to continue.';
            document.body.appendChild(cover);
        } else if (!on && cover) {
            cover.remove();
            cover = null;
        }
    };
    // With DevTools open, a `debugger` statement stops the page and the time it takes shows it. With DevTools closed it costs nothing.
    const check = () => {
        const t = performance.now();
        try { new Function('debugger')(); } catch (e) {}
        show(performance.now() - t > 120);
    };
    setInterval(check, 1000);
};
