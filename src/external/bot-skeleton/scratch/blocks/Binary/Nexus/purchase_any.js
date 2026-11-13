import { localize } from '@deriv-com/translations';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

const TYPES = [["Even", "DIGITEVEN"], ["Odd", "DIGITODD"], ["Over", "DIGITOVER"], ["Under", "DIGITUNDER"], ["Matches", "DIGITMATCH"], ["Differs", "DIGITDIFF"], ["Rise", "CALL"], ["Fall", "PUT"]];

/** Like "Purchase", but the contract type is free, so a bot can start on Over and recover on Even/Odd. */
window.Blockly.Blocks.nx_purchase_any = {
    init() {
        this.jsonInit(this.definition());
        this.setNextStatement(false);
    },
    definition() {
        return {
            message0: localize('Purchase any {{ contract_type }}', { contract_type: '%1' }),
            args0: [{ type: 'field_dropdown', name: 'CONTRACT', options: TYPES }],
            previousStatement: null,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize(
                'Purchases the chosen contract type on the current market, whatever the trade type in Trade parameters is. Set the digit first with "Switch trade" when the type needs one (Over, Under, Matches, Differs).'
            ),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },
    meta() {
        return {
            display_name: localize('Purchase any'),
            description: localize('Purchases any contract type. This block can only be used within the Purchase conditions block.'),
            key_words: localize('buy recovery'),
        };
    },
    customContextMenu(menu) {
        excludeOptionFromContextMenu(menu, [localize('Enable Block'), localize('Disable Block')]);
        modifyContextMenu(menu);
    },
    restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.nx_purchase_any = block => `Bot.purchase('${block.getFieldValue('CONTRACT')}');\n`;
