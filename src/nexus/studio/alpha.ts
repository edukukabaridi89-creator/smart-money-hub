/**
 * The Hub Digit Switcher bots (premium). Built as Blockly XML so they open in Bot Builder and every setting sits in the
 * "Run once at start" block: Stake, Martingale, Take Profit, Stop Loss, Ticks and "Scan All Markets" (true / false).
 *   1  Over <-> Under   (alternates every trade)
 *   2  Even <-> Odd     (alternates every trade)
 *   3  Even / Odd / Over / Under, whichever has the highest share of the last 100 ticks
 * Stake is multiplied by Martingale after a loss and reset after a win. With Scan All Markets on, each trade first moves to the
 * market where the side about to be traded has appeared most in recent ticks.
 */
import { xmlKit } from './advanced';

const { Vars, chain, ifElse, compare, arith, notify, switchTrade, chance, num, shadowNum, id, reset } = xmlKit;

export type AlphaKind = 1 | 2 | 3;
type Side = 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER';
const OVER = 4; // Over 4 wins on 5-9, Under 5 wins on 0-4: both 50%
const UNDER = 5;
const KIND: Record<Side, string> = { DIGITEVEN: 'EVEN', DIGITODD: 'ODD', DIGITOVER: 'OVER', DIGITUNDER: 'UNDER' };
const DIGIT: Record<Side, string> = { DIGITEVEN: 'null', DIGITODD: 'null', DIGITOVER: String(OVER), DIGITUNDER: String(UNDER) };
const NAMES: Record<AlphaKind, string> = { 1: 'The Hub Digit Switcher', 2: 'The Hub 2 Digit Switcher (V2)', 3: 'The Hub 3 Digit Switcher' };
export const alphaName = (k: AlphaKind) => NAMES[k];

const scan = (kind: string, digit: number) => `<block type="nx_scan_markets"><field name="SCOPE">all</field><field name="KIND">${kind}</field><field name="DIGIT">${digit}</field><field name="COUNT">100</field></block>`;

export const buildAlphaXml = (kind: AlphaKind): string => {
    reset();
    const v = new Vars();
    let stockUsed = false;
    const buy = (side: Side) => {
        const stock = !stockUsed;
        stockUsed = true;
        return stock ? `<block type="purchase"><field name="PURCHASE_LIST">${side}</field></block>` : `<block type="nx_purchase_any"><field name="CONTRACT">${side}</field></block>`;
    };
    const scanIf = (k: string, d: number) => ifElse(v.get('Scan All Markets'), scan(k, d));
    const leg = (side: Side, withScan = true) =>
        chain([withScan ? scanIf(KIND[side], side === 'DIGITUNDER' ? UNDER : OVER) : '', switchTrade('', DIGIT[side]), buy(side)]);

    let decide: string;
    if (kind === 1 || kind === 2) {
        const [a, b]: Side[] = kind === 1 ? ['DIGITOVER', 'DIGITUNDER'] : ['DIGITEVEN', 'DIGITODD'];
        decide = ifElse(compare('EQ', v.get('Turn'), num(0)), leg(a), leg(b));
    } else {
        const order: Side[] = ['DIGITEVEN', 'DIGITODD', 'DIGITOVER', 'DIGITUNDER'];
        const share = (s: Side) => chance({ side: s, barrier: s === 'DIGITOVER' ? OVER : s === 'DIGITUNDER' ? UNDER : undefined }, 100);
        const measure = [
            v.set('Best Share', share(order[0])),
            v.set('Pick', num(0)),
            ...order.slice(1).map((s, i) => ifElse(compare('GT', share(s), v.get('Best Share')), chain([v.set('Best Share', share(s)), v.set('Pick', num(i + 1))]))),
        ];
        const act = ifElse(compare('EQ', v.get('Pick'), num(0)), leg(order[0], false),
            ifElse(compare('EQ', v.get('Pick'), num(1)), leg(order[1], false),
                ifElse(compare('EQ', v.get('Pick'), num(2)), leg(order[2], false), leg(order[3], false))));
        decide = chain([scanIf('ANY', OVER), ...measure, act]);
    }

    const alternate = kind === 3 ? '' : v.set('Turn', arith('MINUS', num(1), v.get('Turn')));
    const after = chain([
        v.change('Total', '<block type="read_details"><field name="DETAIL_INDEX">4</field></block>'),
        ifElse(
            '<block type="contract_check_result"><field name="CHECK_RESULT">win</field></block>',
            v.set('Stake', v.get('Initial Stake')),
            v.set('Stake', arith('MULTIPLY', v.get('Stake'), v.get('Martingale')))
        ),
        alternate,
        ifElse(
            compare('GTE', v.get('Total'), v.get('Take Profit')),
            notify('success', 'Take profit reached. Bot stopped.'),
            ifElse(compare('LTE', v.get('Total'), arith('MINUS', num(0), v.get('Stop Loss'))), notify('warn', 'Stop loss reached. Bot stopped.'), '<block type="trade_again"></block>')
        ),
    ]);

    const init = chain([
        v.set('Stake', num(1)),
        v.set('Initial Stake', num(1)),
        v.set('Martingale', num(2)),
        v.set('Take Profit', num(10)),
        v.set('Stop Loss', num(30)),
        v.set('Ticks', num(1)),
        v.set('Scan All Markets', '<block type="logic_boolean"><field name="BOOL">FALSE</field></block>'),
        v.set('Turn', num(0)),
        v.set('Total', num(0)),
        v.set('Pick', num(0)),
        v.set('Best Share', num(0)),
    ]);

    const overUnder = kind === 1;
    const tradetype = overUnder ? 'overunder' : 'evenodd';
    const body = `<block type="trade_definition" id="${id()}" deletable="false" x="0" y="0">
<statement name="TRADE_OPTIONS"><block type="trade_definition_market" deletable="false" movable="false"><field name="MARKET_LIST">synthetic_index</field><field name="SUBMARKET_LIST">random_index</field><field name="SYMBOL_LIST">R_100</field><next>
<block type="trade_definition_tradetype" deletable="false" movable="false"><field name="TRADETYPECAT_LIST">digits</field><field name="TRADETYPE_LIST">${tradetype}</field><next>
<block type="trade_definition_contracttype" deletable="false" movable="false"><field name="TYPE_LIST">both</field><next>
<block type="trade_definition_candleinterval" deletable="false" movable="false"><field name="CANDLEINTERVAL_LIST">60</field><next>
<block type="trade_definition_restartbuysell" deletable="false" movable="false"><field name="TIME_MACHINE_ENABLED">FALSE</field><next>
<block type="trade_definition_restartonerror" deletable="false" movable="false"><field name="RESTARTONERROR">TRUE</field></block>
</next></block></next></block></next></block></next></block></next></block></statement>
<statement name="INITIALIZATION">${init}</statement>
<statement name="SUBMARKET"><block type="trade_definition_tradeoptions"><mutation has_first_barrier="false" has_second_barrier="false" has_prediction="${overUnder}"></mutation><field name="DURATIONTYPE_LIST">t</field><field name="CURRENCY_LIST">USD</field>
<value name="DURATION">${shadowNum(1)}${v.get('Ticks')}</value>
<value name="AMOUNT">${shadowNum(1)}${v.get('Stake')}</value>${overUnder ? `<value name="PREDICTION"><shadow type="math_number_positive"><field name="NUM">${OVER}</field></shadow></value>` : ''}</block></statement>
</block>
<block type="before_purchase" x="0" y="560"><statement name="BEFOREPURCHASE_STACK">${decide}</statement></block>
<block type="after_purchase" x="720" y="0"><statement name="AFTERPURCHASE_STACK">${after}</statement></block>`;
    return `<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false">${v.declarations()}${body}</xml>`;
};
