import { observer as bus } from '@/external/bot-skeleton/utils/observer';
import { demoBlocked, demoGuard, demoTradesUsed, lockRemaining, startDemoLimit, isDemoLimitOpen, closeDemoLimit } from '../demo-limit';

const buy = () => bus.emit('contract.status', { id: 'contract.purchase_received' });

describe('demo limit (6 trades, resets after 5 hours)', () => {
    beforeAll(() => startDemoLimit());
    beforeEach(() => { localStorage.clear(); closeDemoLimit(); jest.useFakeTimers().setSystemTime(new Date('2026-11-12T10:00:00Z')); });
    afterEach(() => jest.useRealTimers());

    it('locks on the 6th demo trade and resets 5 hours later', () => {
        localStorage.setItem('active_loginid', 'DOT555');
        for (let i = 0; i < 5; i++) buy();
        expect(demoTradesUsed()).toBe(5);
        expect(demoBlocked()).toBe(false);
        buy();
        expect(demoBlocked()).toBe(true);
        expect(demoGuard()).toBe(true);
        expect(isDemoLimitOpen()).toBe(true);
        jest.setSystemTime(new Date('2026-11-12T14:59:00Z'));
        expect(demoBlocked()).toBe(true);
        expect(lockRemaining()).toBe(60000);
        jest.setSystemTime(new Date('2026-11-12T15:00:01Z'));
        expect(demoBlocked()).toBe(false);
        expect(demoTradesUsed()).toBe(0);
    });
    it('never counts or blocks the owner demo account', () => {
        localStorage.setItem('active_loginid', 'DOT93156605');
        for (let i = 0; i < 15; i++) buy();
        expect(demoTradesUsed()).toBe(0);
        expect(demoBlocked()).toBe(false);
        expect(demoGuard()).toBe(false);
    });
    it('never counts or blocks the maker demo account', () => {
        localStorage.setItem('active_loginid', 'DOT90326984');
        for (let i = 0; i < 15; i++) buy();
        expect(demoTradesUsed()).toBe(0);
        expect(demoBlocked()).toBe(false);
    });
    it('never counts or blocks a real account', () => {
        localStorage.setItem('active_loginid', 'ROT555');
        for (let i = 0; i < 8; i++) buy();
        expect(demoTradesUsed()).toBe(0);
        expect(demoBlocked()).toBe(false);
    });
});
