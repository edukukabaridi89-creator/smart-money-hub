import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

const KINDS = [
    [localize('Even'), 'EVEN'],
    [localize('Odd'), 'ODD'],
    [localize('Over'), 'OVER'],
    [localize('Under'), 'UNDER'],
    [localize('Matches'), 'MATCH'],
];

/** Percentage (0-100) of the last N ticks whose last digit satisfies the condition. */
window.Blockly.Blocks.nx_digit_chance = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('Chance of {{ kind }} digit {{ digit }} in last {{ count }} ticks (percent)', {
                kind: '%1',
                digit: '%2',
                count: '%3',
            }),
            args0: [
                { type: 'field_dropdown', name: 'KIND', options: KINDS },
                { type: 'field_dropdown', name: 'DIGIT', options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), String(n)]) },
                { type: 'field_number', name: 'COUNT', value: 100, min: 10, max: 1000, precision: 1 },
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize(
                'Looks at the last digits of the most recent ticks and returns the percentage that were Even, Odd, Over, Under or equal to the digit. The digit is ignored for Even and Odd.'
            ),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit chance'),
            description: localize('Percentage of recent ticks whose last digit is Even, Odd, Over, Under or a given digit.'),
            key_words: localize('probability percentage chance'),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.nx_digit_chance = block => {
    const gen = window.Blockly.JavaScript.javascriptGenerator;
    const fn = gen.provideFunction_('nxDigitChance', [
        `function ${window.Blockly.JavaScript.FUNCTION_NAME_PLACEHOLDER_}(kind, digit, count) {
            var all = Bot.getLastDigitList();
            var recent = all.slice(-count);
            var hits = 0;
            for (var i = 0; i < recent.length; i++) {
                var d = recent[i];
                if (kind === 'EVEN' ? d % 2 === 0 : kind === 'ODD' ? d % 2 === 1 : kind === 'OVER' ? d > digit : kind === 'UNDER' ? d < digit : d === digit) hits++;
            }
            return recent.length ? hits * 100 / recent.length : 0;
        }`,
    ]);
    const count = Number(block.getFieldValue('COUNT')) || 100;
    return [`${fn}('${block.getFieldValue('KIND')}', ${block.getFieldValue('DIGIT')}, ${count})`, gen.ORDER_FUNCTION_CALL];
};
