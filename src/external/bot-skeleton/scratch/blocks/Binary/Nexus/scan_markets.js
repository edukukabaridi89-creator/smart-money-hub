import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const base = () => ({
    colour: window.Blockly.Colours.Special1.colour,
    colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
    colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
});
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), String(n)]);
const KINDS = [[localize('Even'), 'EVEN'], [localize('Odd'), 'ODD'], [localize('Over'), 'OVER'], [localize('Under'), 'UNDER'], [localize('Any of the four'), 'ANY']];
const menu = menu_ => modifyContextMenu(menu_);
const gen = () => window.Blockly.JavaScript.javascriptGenerator;

/* Looks at the last N ticks of every market (or just the current one) and moves the bot to the market where `kind`
 * shows up most. "Any of the four" = the best of Even, Odd, Over d and Under d+1 (so d=4 gives Over 4 / Under 5). */
window.Blockly.Blocks.nx_scan_markets = {
    init() {
        this.jsonInit({
            message0: localize('Scan {{ scope }} for best {{ kind }} digit {{ digit }} in last {{ count }} ticks and move there', {
                scope: '%1', kind: '%2', digit: '%3', count: '%4',
            }),
            args0: [
                { type: 'field_dropdown', name: 'SCOPE', options: [[localize('all markets'), 'all'], [localize('this market'), 'this']] },
                { type: 'field_dropdown', name: 'KIND', options: KINDS },
                { type: 'field_dropdown', name: 'DIGIT', options: DIGITS },
                { type: 'field_number', name: 'COUNT', value: 100, min: 10, max: 1000, precision: 1 },
            ],
            previousStatement: null,
            nextStatement: null,
            ...base(),
            tooltip: localize('Checks recent ticks on every volatility market and switches the bot to the one where the chosen outcome has appeared most. Needs a few seconds the first time; results are reused for 15 seconds.'),
            category: window.Blockly.Categories.Before_Purchase,
        });
    },
    meta() {
        return { display_name: localize('Scan markets'), description: localize('Moves the bot to the market where an outcome is most frequent.'), key_words: localize('scan all markets best volatility') };
    },
    customContextMenu: menu,
};
gen().forBlock.nx_scan_markets = block =>
    `Bot.scanMarkets({ scope: '${block.getFieldValue('SCOPE')}', kind: '${block.getFieldValue('KIND')}', digit: ${block.getFieldValue('DIGIT')}, count: ${Number(block.getFieldValue('COUNT')) || 100}, condition: 'ABOVE', threshold: 0 });\n`;

/* Value block: scans (like the block above, but only accepts a market that clears the threshold) and returns the market
 * it moved to, or an empty text when no market qualifies. BARRIER "Both" = use the settings block's strategy (default Even). */
window.Blockly.Blocks.chartlord_best_market = {
    init() {
        this.jsonInit({
            message0: localize('Best market: {{ condition }} threshold {{ threshold }} % over {{ count }} ticks, strategy {{ barrier }}', {
                condition: '%1', threshold: '%2', count: '%3', barrier: '%4',
            }),
            args0: [
                { type: 'field_dropdown', name: 'CONDITION', options: [[localize('above'), 'ABOVE'], [localize('below'), 'BELOW']] },
                { type: 'input_value', name: 'THRESHOLD', check: 'Number' },
                { type: 'input_value', name: 'TICK_COUNT', check: 'Number' },
                { type: 'field_dropdown', name: 'BARRIER', options: [[localize('Both (use settings block)'), 'BOTH'], ...KINDS] },
            ],
            inputsInline: true,
            output: 'String',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            ...base(),
            tooltip: localize('Scans the markets and moves the bot to the best one that is above (or below) the threshold. Returns the market name, or empty text if none qualifies.'),
            category: window.Blockly.Categories.Before_Purchase,
        });
    },
    meta() {
        return { display_name: localize('Best market'), description: localize('Finds and moves to the market that clears a percentage threshold.'), key_words: localize('scan best market volatility filter') };
    },
    customContextMenu: menu,
};
gen().forBlock.chartlord_best_market = block => {
    const g = gen();
    const filter = block.workspace.getBlocksByType('trade_definition_volatilityfilter', false)[0];
    const fv = (name, d) => (filter ? filter.getFieldValue(name) : d);
    const barrier = block.getFieldValue('BARRIER');
    const kind = barrier === 'BOTH' ? fv('STRATEGY_LIST', 'EVEN') : barrier;
    const digit = barrier === 'BOTH' ? fv('BARRIER_DIGIT', '5') : '4';
    const scope = fv('MULTI_MARKET_LIST', 'ENABLE') === 'ENABLE' ? 'all' : 'this';
    const threshold = g.valueToCode(block, 'THRESHOLD', g.ORDER_NONE) || fv('THRESHOLD', '70');
    const count = g.valueToCode(block, 'TICK_COUNT', g.ORDER_NONE) || fv('TICK_COUNT', '15');
    return [`Bot.scanMarkets({ scope: '${scope}', kind: '${kind}', digit: ${digit}, count: ${count}, condition: '${block.getFieldValue('CONDITION')}', threshold: ${threshold} })`, g.ORDER_FUNCTION_CALL];
};

/* Moves the bot to the next volatility market in the list, one step each time it runs. */
window.Blockly.Blocks.strategy_rotate_market = {
    init() {
        this.jsonInit({
            message0: localize('Rotate to the next market'),
            previousStatement: null,
            nextStatement: null,
            ...base(),
            tooltip: localize('Moves the bot to the next volatility market in the list (Volatility 10, 25, 50, 75, 100, then the 1-second ones) each time it runs.'),
            category: window.Blockly.Categories.Before_Purchase,
        });
    },
    meta() {
        return { display_name: localize('Rotate market'), description: localize('Moves to the next market each time.'), key_words: localize('rotate change market volatility') };
    },
    customContextMenu: menu,
};
gen().forBlock.strategy_rotate_market = () => 'Bot.rotateMarket();\n';
