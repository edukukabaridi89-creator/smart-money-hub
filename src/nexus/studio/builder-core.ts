import { kindOf, needsBarrier, type BotSpec } from './bot-spec';

/**
 * Turns a BotSpec into Bot Builder XML by filling one of the app's own strategy templates (src/xml/*.xml) the same way
 * the Quick Strategy form does: dropdown fields are set by name, numeric inputs through their `strategy_value` placeholder.
 * Plain string editing on purpose, so it needs no DOM and behaves the same in the browser and in tests.
 */

export const templateName = (s: BotSpec): string => {
    const cap = s.maxStake !== null && s.maxStake !== undefined;
    switch (s.progression) {
        case 'martingale': return cap ? 'martingale_max-stake' : 'martingale';
        case 'reverse_martingale': return 'reverse_martingale';
        case 'dalembert': return cap ? 'dalembert_max-stake' : 'dalembert';
        case 'reverse_dalembert': return 'reverse_dalembert';
        case 'oscars_grind': return cap ? 'oscars_grind_max-stake' : 'oscars_grind';
        case 'one_three_two_six': return '1_3_2_6';
        default: return 'martingale'; // flat stake = martingale with a multiplier of 1
    }
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Index just after the closing tag that matches the opening tag starting at `start` (nesting-aware). */
const closeIndex = (xml: string, start: number, tag: string): number => {
    const re = new RegExp(`<${tag}\\b[^>]*?(/?)>|</${tag}>`, 'g');
    re.lastIndex = start;
    let depth = 0, m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
        if (m[0].startsWith('</')) { if (--depth === 0) return m.index + m[0].length; }
        else if (m[1] === '/') { if (depth === 0) return m.index + m[0].length; }
        else depth++;
    }
    return -1;
};

/** Replaces the content of every <value strategy_value="key"> element. Returns how many were replaced. */
const setPlaceholder = (xml: string, key: string, inner: string): { xml: string; count: number } => {
    const open = new RegExp(`<value\\b[^>]*\\bstrategy_value="${key}"[^>]*>`, 'g');
    let out = xml, count = 0, m: RegExpExecArray | null;
    while ((m = open.exec(out))) {
        const end = closeIndex(out, m.index, 'value');
        if (end < 0) break;
        const innerStart = m.index + m[0].length, innerEnd = end - '</value>'.length;
        out = out.slice(0, innerStart) + inner + out.slice(innerEnd);
        count++;
        open.lastIndex = innerStart + inner.length + '</value>'.length;
    }
    return { xml: out, count };
};

const setField = (xml: string, name: string, value: string) =>
    xml.replace(new RegExp(`(<field\\s+name="${name}"[^>]*>)[^<]*(</field>)`, 'g'), (_m, a, b) => `${a}${esc(value)}${b}`);

const num = (n: number) => `<shadow type="math_number"><field name="NUM">${n}</field></shadow>`;
const bool = (v: boolean) => `<block type="logic_boolean"><field name="BOOL">${v ? 'TRUE' : 'FALSE'}</field></block>`;
const OPS = { EQ: 'EQ', GT: 'GT', LT: 'LT' } as const;

export const applySpec = (template: string, s: BotSpec): string => {
    let xml = template;
    const { tradetype, tradetypecat } = kindOf(s.side);

    // Digit contracts that need a digit get a PREDICTION input right after AMOUNT (as Quick Strategy does).
    if (needsBarrier(s.side)) {
        const a = xml.indexOf('<value name="AMOUNT"');
        const end = a >= 0 ? closeIndex(xml, a, 'value') : -1;
        if (end > 0) {
            xml = xml.slice(0, end) + `<value name="PREDICTION" strategy_value="last_digit_prediction"><shadow type="math_number_positive"><field name="NUM">0</field></shadow></value>` + xml.slice(end);
            xml = xml.replace(/(<block type="trade_definition_tradeoptions"[^>]*>\s*<mutation[^>]*?)has_prediction="false"/, '$1has_prediction="true"');
        }
    }

    // dropdown fields
    const fields: Record<string, string> = {
        MARKET_LIST: 'synthetic_index', SUBMARKET_LIST: 'random_index', SYMBOL_LIST: s.symbol, TRADETYPECAT_LIST: tradetypecat, TRADETYPE_LIST: tradetype,
        TYPE_LIST: 'both', PURCHASE_LIST: s.side, DURATIONTYPE_LIST: 't',
    };
    Object.entries(fields).forEach(([k, v]) => (xml = setField(xml, k, v)));

    // numeric / boolean placeholders (a key that a template doesn't have is simply skipped)
    const cap = s.maxStake !== null && s.maxStake !== undefined;
    const values: Record<string, string> = {
        duration: num(s.duration), stake: num(s.stake), profit: num(s.takeProfit), loss: num(s.stopLoss),
        size: num(s.progression === 'flat' ? 1 : s.multiplier ?? 2),
        dalembert_unit: num(s.unit ?? 1), alembert_unit: num(s.unit ?? 1), oscar_unit: num(s.unit ?? 1),
        boolean_max_stake: bool(cap), max_stake: num(cap ? (s.maxStake as number) : Math.round(s.stake * 10 * 100) / 100),
    };
    if (needsBarrier(s.side)) values.last_digit_prediction = num(s.barrier ?? 0);
    Object.entries(values).forEach(([k, v]) => (xml = setPlaceholder(xml, k, v).xml));

    // entry condition: only buy when the last digit matches (before_purchase runs on every tick until a trade is placed)
    if (s.entry.mode === 'digit') {
        const st = xml.indexOf('<statement name="BEFOREPURCHASE_STACK">');
        const p = st >= 0 ? xml.indexOf('<block type="purchase"', st) : -1;
        const pend = p >= 0 ? closeIndex(xml, p, 'block') : -1;
        if (pend > 0) {
            const purchase = xml.slice(p, pend);
            const cond =
                `<block type="controls_if"><value name="IF0"><block type="logic_compare"><field name="OP">${OPS[s.entry.op]}</field>` +
                `<value name="A"><block type="last_digit"></block></value><value name="B"><block type="math_number"><field name="NUM">${s.entry.digit}</field></block></value>` +
                `</block></value><statement name="DO0">${purchase}</statement></block>`;
            xml = xml.slice(0, p) + cond + xml.slice(pend);
        }
    }
    return xml;
};
