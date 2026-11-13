// Dependency-free so the vendored trade engine can import it without circular imports.
export type SpeedMode = 'NORMAL' | 'SKIP_TICK' | 'TURBO';
export const speedState: { mode: SpeedMode } = { mode: (localStorage.getItem('nexus_speed') as SpeedMode) || 'NORMAL' };
export const SPEED_MODES: { id: SpeedMode; label: string; hint: string }[] = [
    { id: 'NORMAL', label: 'Normal', hint: 'Wait for each contract to settle before the next trade' },
    { id: 'SKIP_TICK', label: 'Fast', hint: 'Skip 1 tick after every executed trade' },
    { id: 'TURBO', label: 'Turbo', hint: 'Trade on every tick without waiting for settlement' },
];
