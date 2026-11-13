import { buildAdvancedXml, toAdv, validateAdv } from '../advanced';
import { finalize, isComplete } from '../bot-spec';
import { opening, step } from '../conversation';
import type { Draft } from '../bot-spec';
import type { Slot } from '../nlu';

const run = (texts: string[]) => {
    let t = opening();
    let d: Draft = {};
    let ex: Slot | null = t.expecting;
    for (const x of texts) { t = step(d, { text: x }, ex); d = t.draft; ex = t.expecting; }
    return { t, d, ex };
};
const BASE = 'on Volatility 50, 1 tick, stake 1, martingale x2, no cap, take profit 10, stop loss 30, every tick';

describe('advanced studio flow', () => {
    it('even, recover odd', () => {
        const { d, ex } = run([`Even ${BASE}, recover on odd`]);
        expect(d.side).toBe('DIGITEVEN'); expect(d.recover).toBe('fixed'); expect(d.recoverSide).toBe('DIGITODD'); expect(ex).toBeNull();
        const spec = finalize(d, 'x'); expect(validateAdv(toAdv(spec))).toEqual([]);
        expect(buildAdvancedXml(toAdv(spec))).toContain('nx_purchase_any');
    });
    it('over, recover on even or odd by probability', () => {
        const { d, ex } = run([`Start with over 3 ${BASE} and recover with even or odd depending on the probability`]);
        expect(d.side).toBe('DIGITOVER'); expect(d.barrier).toBe(3); expect(d.recover).toBe('best'); expect(d.recoverFamily).toBe('evenodd'); expect(ex).toBeNull();
        expect(isComplete(d)).toBe(true);
    });
    it('change volatility on loss', () => {
        const { d, ex } = run([`Even ${BASE}, change volatility on loss between vol 10, vol 25 and vol 75`]);
        expect(d.switchAfter).toBe(1); expect(d.switchMarkets).toEqual(['R_10', 'R_25', 'R_75']); expect(ex).toBeNull();
    });
    it('asks the smart question and walks the chips', () => {
        let r = run([`Even ${BASE}`]);
        expect(r.ex).toBe('advanced');
        let t = step(r.d, { patch: { advanced: true, recover: 'ask' } }, r.ex); expect(t.expecting).toBe('recoverKind');
        t = step(t.draft, { text: 'odd' }, t.expecting); expect(t.draft.recoverSide).toBe('DIGITODD'); expect(t.expecting).toBeNull();
    });
    it('pick the likelier side', () => {
        const { d, ex } = run([`Even or odd depending on the probability ${BASE}`]);
        expect(d.pickBest).toBe(true); expect(d.side).toBe('DIGITEVEN'); expect(ex).toBeNull();
    });
    it('simple answer ends the flow', () => {
        const r = run([`Even ${BASE}`, 'no']);
        expect(r.ex).toBeNull(); expect(r.d.advanced).toBe(true);
        expect(finalize(r.d).adv).toBeUndefined();
    });
});
