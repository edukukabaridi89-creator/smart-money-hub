import { planFor, specFor } from '../risk-plan';

describe('risk plan', () => {
    it('uses 10% of capital as the stake and doubles it after each loss', () => {
        const p = planFor(100);
        expect(p.stake).toBe(10);
        expect(p.steps.map(s => s.stake)).toEqual([10, 20, 40, 80, 160, 320]);
        expect(p.steps.map(s => s.lost)).toEqual([10, 30, 70, 150, 310, 630]);
        expect(p.survivable).toBe(3); // 10+20+40 = 70 fits in 100, the next one (150) does not
        expect(p.maxStake).toBe(40);
        expect(p.stopLoss).toBe(70);
        expect(p.takeProfit).toBe(20);
    });
    it('rejects empty or too-small capital', () => {
        expect(planFor(0).valid).toBe(false);
        expect(planFor(NaN).valid).toBe(false);
        expect(planFor(3).valid).toBe(false); // stake 0.30 < 0.35 minimum
        expect(planFor(3.5).valid).toBe(true);
        expect(planFor(3.5).minCapital).toBe(3.5);
    });
    it('builds a martingale spec that enters on the suggested digit', () => {
        const sug: any = { symbol: 'R_25', type: 'DIGITUNDER', barrier: 7, label: 'Under 7', trigger: 4, edge: 1, z: 2, rate: 75, samples: 100 };
        const s = specFor(planFor(200), sug);
        expect(s).toMatchObject({ symbol: 'R_25', side: 'DIGITUNDER', barrier: 7, stake: 20, duration: 1, progression: 'martingale', multiplier: 2, maxStake: 80, entry: { mode: 'digit', op: 'EQ', digit: 4 } });
        const even: any = { symbol: 'R_10', type: 'DIGITEVEN', barrier: 0, label: 'Even', trigger: 2 };
        expect(specFor(planFor(200), even).barrier).toBeUndefined();
    });
});
