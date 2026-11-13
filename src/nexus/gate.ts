import { hub } from './ticks-hub';
import { speedState } from './speed';

/** Applies the global Execution Speed Mode to one automated module. Mode is read live on every tick. */
export class SpeedGate {
    private pending = 0;
    private last: Record<string, number> = {};
    can(symbol: string, seq: number) {
        const m = speedState.mode;
        if (m === 'TURBO') return true; // every tick, no waiting
        if (m === 'SKIP_TICK') return seq - (this.last[symbol] ?? -99) >= 2; // skip exactly 1 tick after a trade
        return this.pending === 0; // NORMAL: previous contracts must have settled
    }
    async run<T>(symbol: string, seq: number, fire: () => Promise<T>) {
        this.last[symbol] = seq;
        this.pending++;
        try {
            return await fire();
        } finally {
            this.pending--;
        }
    }
}

/** Tick-driven repeat runner (used by Hedge Hub / Bulk Trader auto-repeat). Returns a stop function. */
export const startRunner = (symbol: () => string, fire: () => Promise<unknown>) => {
    const gate = new SpeedGate();
    hub.watch([symbol()]);
    return hub.onTick((sym, seq) => {
        if (sym !== symbol() || !gate.can(sym, seq)) return;
        gate.run(sym, seq, fire);
    });
};
