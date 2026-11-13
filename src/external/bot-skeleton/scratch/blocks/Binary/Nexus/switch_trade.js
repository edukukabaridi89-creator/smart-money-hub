import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const MARKETS = [["Volatility 10", "R_10"], ["Volatility 25", "R_25"], ["Volatility 50", "R_50"], ["Volatility 75", "R_75"], ["Volatility 100", "R_100"], ["Volatility 10 (1s)", "1HZ10V"], ["Volatility 15 (1s)", "1HZ15V"], ["Volatility 25 (1s)", "1HZ25V"], ["Volatility 30 (1s)", "1HZ30V"], ["Volatility 50 (1s)", "1HZ50V"], ["Volatility 75 (1s)", "1HZ75V"], ["Volatility 90 (1s)", "1HZ90V"], ["Volatility 100 (1s)", "1HZ100V"]];
const KEEP = [[localize('keep'), '']];
const DIGITS = [...KEEP, [localize('none'), 'null'], ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), String(n)])];
const TICKS = [...KEEP, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [String(n), String(n)])];

/** Change market / digit / duration for the trades that follow. Anything set to "keep" is left alone. */
window.Blockly.Blocks.nx_switch_trade = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Switch trade: market {{ market }} digit {{ digit }} ticks {{ ticks }}', {
                market: '%1',
                digit: '%2',
                ticks: '%3',
            }),
            args0: [
                { type: 'field_dropdown', name: 'MARKET', options: [...KEEP, ...MARKETS] },
                { type: 'field_dropdown', name: 'DIGIT', options: DIGITS },
                { type: 'field_dropdown', name: 'TICKS', options: TICKS },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Changes the market, the digit (Over/Under/Matches/Differs) and the number of ticks used by the trades that come after this block. Choose "keep" to leave a setting as it is. Use "none" for the digit before trading Even/Odd or Rise/Fall.'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Switch trade'),
            description: localize('Changes the market, digit or ticks for the next trades while the bot is running.'),
            key_words: localize('change volatility market recovery'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.nx_switch_trade = block => {
    const market = block.getFieldValue('MARKET');
    const digit = block.getFieldValue('DIGIT');
    const ticks = block.getFieldValue('TICKS');
    const parts = [];
    if (market) parts.push(`symbol: '${market}'`);
    if (digit) parts.push(`prediction: ${digit}`);
    if (ticks) parts.push(`duration: ${ticks}`);
    return parts.length ? `Bot.switchTrade({ ${parts.join(', ')} });\n` : '';
};
