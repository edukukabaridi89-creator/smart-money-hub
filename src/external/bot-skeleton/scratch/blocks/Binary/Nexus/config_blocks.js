import { localize } from '@deriv-com/translations';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

/* Three small settings blocks that sit in "Trade parameters" under the stock ones (used by the premium bots).
 *  - Speed trading : reserved, has no effect yet.
 *  - Bulk count    : only 1 is supported (one contract per purchase).
 *  - Volatility filter : settings that "Best market" (scan all markets) uses when its own boxes are empty/BOTH:
 *      STRATEGY_LIST (Even/Odd/Over/Under), BARRIER_DIGIT, MULTI_MARKET_LIST (scan every market or only the current one),
 *      and default THRESHOLD / TICK_COUNT. ENABLED_LIST is reserved. */
const settingsBlock = (type, message, args, required) => {
    window.Blockly.Blocks[type] = {
        init() {
            this.jsonInit({
                message0: message,
                args0: args,
                colour: window.Blockly.Colours.Base.colour,
                colourSecondary: window.Blockly.Colours.Base.colourSecondary,
                colourTertiary: window.Blockly.Colours.Base.colourTertiary,
                previousStatement: null,
                nextStatement: null,
            });
            this.setMovable(false);
            this.setDeletable(false);
        },
        onchange() {
            if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) return;
            this.enforceLimitations();
        },
        customContextMenu(menu) {
            excludeOptionFromContextMenu(menu, [localize('Enable Block'), localize('Disable Block')]);
            modifyContextMenu(menu);
        },
        enforceLimitations() {
            return window.Blockly.Blocks.trade_definition_market.enforceLimitations.call(this);
        },
        required_inputs: required,
    };
    window.Blockly.JavaScript.javascriptGenerator.forBlock[type] = () => {};
};

settingsBlock(
    'trade_definition_speedtrading',
    localize('Speed trading (reserved, no effect yet): {{ checkbox }}', { checkbox: '%1' }),
    [{ type: 'field_checkbox', name: 'SPEED_TRADING', checked: false, class: 'blocklyCheckbox' }],
    ['SPEED_TRADING']
);

settingsBlock(
    'trade_definition_bulkcount',
    localize('Contracts per purchase (only 1 is supported): {{ count }}', { count: '%1' }),
    [{ type: 'field_number', name: 'BULK_COUNT', value: 1, min: 1, max: 1, precision: 1 }],
    ['BULK_COUNT']
);

const yn = [[localize('Enable'), 'ENABLE'], [localize('Disable'), 'DISABLE']];
settingsBlock(
    'trade_definition_volatilityfilter',
    localize('Market scanner settings: filter {{ enabled }} threshold {{ threshold }}% strategy {{ strategy }} digit {{ digit }} ticks {{ ticks }} scan all markets {{ multi }}', {
        enabled: '%1', threshold: '%2', strategy: '%3', digit: '%4', ticks: '%5', multi: '%6',
    }),
    [
        { type: 'field_dropdown', name: 'ENABLED_LIST', options: yn },
        { type: 'field_number', name: 'THRESHOLD', value: 70, min: 0, max: 100, precision: 1 },
        { type: 'field_dropdown', name: 'STRATEGY_LIST', options: [[localize('Even'), 'EVEN'], [localize('Odd'), 'ODD'], [localize('Over'), 'OVER'], [localize('Under'), 'UNDER']] },
        { type: 'field_dropdown', name: 'BARRIER_DIGIT', options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), String(n)]) },
        { type: 'field_number', name: 'TICK_COUNT', value: 15, min: 5, max: 1000, precision: 1 },
        { type: 'field_dropdown', name: 'MULTI_MARKET_LIST', options: yn },
    ],
    ['THRESHOLD', 'TICK_COUNT']
);
