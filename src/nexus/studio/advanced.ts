import { kindOf, needsBarrier, NO_LIMIT, oppositeOf, SIDE_LABEL, type BotSpec, type Side } from './bot-spec';

/**
 * "Advanced" bots: strategies that change what they trade while running. They need Bot Builder blocks the stock
 * templates don't have (Switch trade, Purchase any, Digit chance), so the XML is built here from scratch instead of
 * filling one of src/xml/*.xml.
 *
 *  - recovery:      after a loss, trade a different type / digit until a win (e.g. start on Over 3, recover on Even/Odd)
 *  - best-of:       choose between two sides at every trade by which one appeared more often in the last N ticks
 *  - market switch: after N losses in a row, move to the next volatility in a list
 */

export type Leg = { side: Side; barrier?: number };
/** One leg = always that side. Two legs = whichever appeared more often in the last `window` ticks (ties go to the first). */
export type Choice = { a: Leg; b?: Leg };

export type AdvSpec = {
    name: string;
    symbol: string;
    stake: number;
    duration: number; // ticks
    takeProfit: number;
    stopLoss: number;
    multiplier: number; // stake x multiplier after each loss (1 = flat stake)
    maxStake: number | null;
    window: number; // ticks looked at when choosing between two legs
    primary: Choice;
    recovery: Choice | null; // used after a loss, until the next win
    marketSwitch: { after: number; markets: string[] } | null;
    entry: { mode: 'any' } | { mode: 'digit'; op: 'EQ' | 'GT' | 'LT'; digit: number };
};

const CHANCE_KIND: Partial<Record<Side, string>> = { DIGITEVEN: 'EVEN', DIGITODD: 'ODD', DIGITOVER: 'OVER', DIGITUNDER: 'UNDER', DIGITMATCH: 'MATCH' };
/** Sides that can be compared by their chance of appearing (best-of needs both legs to be one of these). */
export const canCompare = (s: Side) => s in CHANCE_KIND;
export const legLabel = (l: Leg) => `${SIDE_LABEL[l.side]}${needsBarrier(l.side) && l.barrier !== undefined ? ` ${l.barrier}` : ''}`;
export const choiceLabel = (c: Choice) => (c.b ? `best of ${legLabel(c.a)} / ${legLabel(c.b)}` : legLabel(c.a));

/** Problems that would make the bot invalid; empty when the spec is fine. */
export const validateAdv = (s: AdvSpec): string[] => {
    const e: string[] = [];
    const legs = [s.primary.a, s.primary.b, s.recovery?.a, s.recovery?.b].filter(Boolean) as Leg[];
    legs.forEach(l => {
        if (needsBarrier(l.side) && (l.barrier === undefined || l.barrier < 0 || l.barrier > 9)) e.push(`${SIDE_LABEL[l.side]} needs a digit from 0 to 9.`);
        if (l.side === 'DIGITOVER' && l.barrier === 9) e.push('Over 9 can never win.');
        if (l.side === 'DIGITUNDER' && l.barrier === 0) e.push('Under 0 can never win.');
    });
    [s.primary, s.recovery].forEach(c => c?.b && (!canCompare(c.a.side) || !canCompare(c.b.side)) && e.push('Only Even, Odd, Over, Under and Matches can be compared by chance.'));
    const rf = legs.some(l => l.side === 'CALL' || l.side === 'PUT');
    if (rf && s.duration < 5) e.push('Rise/Fall needs at least 5 ticks.');
    if (rf && legs.some(l => l.side.startsWith('DIGIT'))) e.push('Rise/Fall cannot be mixed with digit trades in one bot.');
    if (s.marketSwitch && s.marketSwitch.markets.length < 2) e.push('Switching markets needs at least two markets.');
    return e;
};

// ---------- tiny XML builder ----------
let seq = 0;
const id = () => `nx${(++seq).toString(36)}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => `<block type="math_number"><field name="NUM">${n}</field></block>`;
const shadowNum = (n: number) => `<shadow type="math_number"><field name="NUM">${n}</field></shadow>`;
const text = (t: string) => `<shadow type="text"><field name="TEXT">${esc(t)}</field></shadow>`;

class Vars {
    private ids = new Map<string, string>();
    id(name: string) { if (!this.ids.has(name)) this.ids.set(name, `v_${name.replace(/\W/g, '_')}_${this.ids.size}`); return this.ids.get(name)!; }
    get(name: string) { return `<block type="variables_get"><field name="VAR" id="${this.id(name)}" variabletype="">${name}</field></block>`; }
    set(name: string, value: string, next = '') { return `<block type="variables_set"><field name="VAR" id="${this.id(name)}" variabletype="">${name}</field><value name="VALUE">${value}</value>${next ? `<next>${next}</next>` : ''}</block>`; }
    change(name: string, delta: string, next = '') { return `<block type="math_change"><field name="VAR" id="${this.id(name)}" variabletype="">${name}</field><value name="DELTA">${delta}</value>${next ? `<next>${next}</next>` : ''}</block>`; }
    declarations() { return `<variables>${[...this.ids].map(([n, i]) => `<variable type="" id="${i}" islocal="false" iscloud="false">${n}</variable>`).join('')}</variables>`; }
}

/** Chains statement blocks (each already a complete `<block>` without <next>) into one stack. */
const chain = (blocks: string[]): string => {
    const list = blocks.filter(Boolean);
    return list.reduceRight((tail, b) => (tail ? b.replace(/<\/block>$/, `<next>${tail}</next></block>`) : b), '');
};
const ifElse = (cond: string, thenStack: string, elseStack?: string) =>
    `<block type="controls_if">${elseStack !== undefined ? '<mutation else="1"></mutation>' : ''}<value name="IF0">${cond}</value><statement name="DO0">${thenStack}</statement>${elseStack !== undefined ? `<statement name="ELSE">${elseStack}</statement>` : ''}</block>`;
const compare = (op: string, a: string, b: string) => `<block type="logic_compare"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const arith = (op: string, a: string, b: string) => `<block type="math_arithmetic"><field name="OP">${op}</field><value name="A">${a}</value><value name="B">${b}</value></block>`;
const notify = (kind: 'success' | 'warn', msg: string) => `<block type="notify"><field name="NOTIFICATION_TYPE">${kind}</field><field name="NOTIFICATION_SOUND">silent</field><value name="MESSAGE">${text(msg)}</value></block>`;
const switchTrade = (market: string, digit: string, ticks = '') => `<block type="nx_switch_trade"><field name="MARKET">${market}</field><field name="DIGIT">${digit}</field><field name="TICKS">${ticks}</field></block>`;
const chance = (l: Leg, window: number) => `<block type="nx_digit_chance"><field name="KIND">${CHANCE_KIND[l.side]}</field><field name="DIGIT">${l.barrier ?? 0}</field><field name="COUNT">${window}</field></block>`;
const digitField = (l: Leg) => (needsBarrier(l.side) ? String(l.barrier ?? 0) : 'null'); // 'null' clears the digit for Even/Odd and Rise/Fall

export const buildAdvancedXml = (s: AdvSpec): string => {
    seq = 0;
    const v = new Vars();
    const { tradetype, tradetypecat } = kindOf(s.primary.a.side);
    const primaryNeedsDigit = needsBarrier(s.primary.a.side);
    const capped = s.maxStake !== null && s.maxStake < NO_LIMIT;
    let standardPurchaseUsed = false;

    /** Purchase for one leg. The first leg of the primary choice uses the stock Purchase block (Bot Builder requires one). */
    const buyLeg = (l: Leg, allowStock: boolean) => {
        const stock = allowStock && !standardPurchaseUsed;
        if (stock) standardPurchaseUsed = true;
        const buy = stock ? `<block type="purchase"><field name="PURCHASE_LIST">${l.side}</field></block>` : `<block type="nx_purchase_any"><field name="CONTRACT">${l.side}</field></block>`;
        return chain([switchTrade('', digitField(l)), buy]);
    };
    const buyChoice = (c: Choice, allowStock: boolean) =>
        c.b ? ifElse(compare('GTE', chance(c.a, s.window), chance(c.b, s.window)), buyLeg(c.a, allowStock), buyLeg(c.b, false)) : buyLeg(c.a, allowStock);

    // ---- before purchase ----
    let decide = s.recovery
        ? ifElse(compare('EQ', v.get('recovering'), num(1)), buyChoice(s.recovery, false), buyChoice(s.primary, true))
        : buyChoice(s.primary, true);
    if (s.entry.mode === 'digit') {
        decide = ifElse(compare(s.entry.op, '<block type="last_digit"></block>', num(s.entry.digit)), decide);
    }

    // ---- after purchase ----
    const onWin = chain([
        v.set('recovering', num(0)),
        v.set('losses', num(0)),
        v.set('stake', v.get('base')),
    ]);
    const marketSteps = (): string => {
        if (!s.marketSwitch) return '';
        const { after, markets } = s.marketSwitch;
        const pick = markets.reduceRight((tail, m, i) => (i === markets.length - 1 ? switchTrade(m, '') : ifElse(compare('EQ', v.get('mIdx'), num(i)), switchTrade(m, ''), tail)), '');
        return ifElse(
            compare('GTE', v.get('losses'), num(after)),
            chain([
                v.set('losses', num(0)),
                v.change('mIdx', num(1)),
                ifElse(compare('GTE', v.get('mIdx'), num(markets.length)), v.set('mIdx', num(0))),
                pick,
            ])
        );
    };
    const onLoss = chain([
        v.change('losses', num(1)),
        s.recovery ? v.set('recovering', num(1)) : '',
        s.multiplier !== 1 ? v.set('stake', arith('MULTIPLY', v.get('stake'), num(s.multiplier))) : '',
        capped ? ifElse(compare('GT', v.get('stake'), num(s.maxStake as number)), v.set('stake', num(s.maxStake as number))) : '',
        marketSteps(),
    ]);
    const after = chain([
        v.change('total', '<block type="read_details"><field name="DETAIL_INDEX">4</field></block>'),
        ifElse('<block type="contract_check_result"><field name="CHECK_RESULT">win</field></block>', onWin, onLoss),
        ifElse(
            compare('GTE', v.get('total'), num(s.takeProfit)),
            notify('success', 'Take profit reached. Bot stopped.'),
            ifElse(
                compare('LTE', v.get('total'), num(-s.stopLoss)),
                notify('warn', 'Stop loss reached. Bot stopped.'),
                '<block type="trade_again"></block>'
            )
        ),
    ]);

    // ---- run once at start ----
    const init = chain([
        v.set('base', num(s.stake)),
        v.set('stake', num(s.stake)),
        v.set('recovering', num(0)),
        v.set('losses', num(0)),
        v.set('mIdx', num(0)),
        v.set('total', num(0)),
    ]);

    const predictionInput = primaryNeedsDigit ? `<value name="PREDICTION"><shadow type="math_number_positive"><field name="NUM">${s.primary.a.barrier ?? 0}</field></shadow></value>` : '';
    const body = `<block type="trade_definition" id="${id()}" deletable="false" x="0" y="0">
<statement name="TRADE_OPTIONS"><block type="trade_definition_market" deletable="false" movable="false"><field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">${s.symbol}</field><next>
<block type="trade_definition_tradetype" deletable="false" movable="false"><field name="TRADETYPECAT_LIST">${tradetypecat}</field><field name="TRADETYPE_LIST">${tradetype}</field><next>
<block type="trade_definition_contracttype" deletable="false" movable="false"><field name="TYPE_LIST">both</field><next>
<block type="trade_definition_candleinterval" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field><next>
<block type="trade_definition_restartbuysell" deletable="false" movable="false"><field name="TIME_MACHINE_ENABLED">FALSE</field><next>
<block type="trade_definition_restartonerror" deletable="false" movable="false"><field name="RESTARTONERROR">TRUE</field></block>
</next></block></next></block></next></block></next></block></next></block></statement>
<statement name="INITIALIZATION">${init}</statement>
<statement name="SUBMARKET"><block type="trade_definition_tradeoptions"><mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${primaryNeedsDigit}"></mutation><field name="DURATIONTYPE_LIST">t</field><field name="CURRENCY_LIST">USD</field>
<value name="DURATION">${shadowNum(s.duration)}</value>
<value name="AMOUNT">${shadowNum(s.stake)}${v.get('stake')}</value>${predictionInput}</block></statement>
</block>
<block type="before_purchase" x="0" y="420"><statement name="BEFOREPURCHASE_STACK">${decide}</statement></block>
<block type="after_purchase" x="640" y="0"><statement name="AFTERPURCHASE_STACK">${after}</statement></block>`;
    return `<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false">${v.declarations()}${body}</xml>`;
};

/** BotSpec (with its `adv` part) -> the shape buildAdvancedXml works from. */
export const toAdv = (b: BotSpec): AdvSpec => {
    const x = b.adv!;
    const leg = (side: Side, barrier?: number): Leg => ({ side, barrier: needsBarrier(side) ? barrier : undefined });
    const main = leg(b.side, b.barrier);
    const primary: Choice = x.pickBest ? { a: main, b: leg(oppositeOf(b.side), b.barrier) } : { a: main };
    let recovery: Choice | null = null;
    const r = x.recovery;
    if (r?.mode === 'opposite') recovery = { a: leg(oppositeOf(b.side), b.barrier) };
    else if (r?.mode === 'fixed') recovery = { a: leg(r.side, r.barrier) };
    else if (r?.mode === 'best') recovery = r.family === 'evenodd' ? { a: leg('DIGITEVEN'), b: leg('DIGITODD') } : { a: leg('DIGITOVER', r.barrier), b: leg('DIGITUNDER', r.barrier) };
    return {
        name: b.name, symbol: b.symbol, stake: b.stake, duration: b.duration, takeProfit: b.takeProfit, stopLoss: b.stopLoss,
        multiplier: b.progression === 'martingale' ? b.multiplier ?? 2 : 1,
        maxStake: b.progression === 'martingale' ? b.maxStake ?? null : null,
        window: x.window, primary, recovery, marketSwitch: x.marketSwitch, entry: b.entry,
    };
};

/** Builder helpers shared with alpha.ts (the Alpha Digit Switcher bots). */
export const xmlKit = { Vars, chain, ifElse, compare, arith, notify, switchTrade, chance, num, shadowNum, id, reset: () => { seq = 0; } };
