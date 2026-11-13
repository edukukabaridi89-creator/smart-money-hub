/** The hello pop-up is shown once on this browser (the first time someone is logged in). */
const KEY = 'nx_hello_done';
export const helloSeen = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
export const markHelloSeen = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} };
/** True when someone is logged in and has not yet seen the hello pop-up. */
export const helloDue = () => {
    try { return !!localStorage.getItem('active_loginid') && !helloSeen(); } catch (e) { return false; }
};
