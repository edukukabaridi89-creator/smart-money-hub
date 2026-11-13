import { applySpec, templateName } from './builder-core';
import { buildAdvancedXml, toAdv, validateAdv } from './advanced';
import type { BotSpec } from './bot-spec';

/** Loads the strategy template the same way the Quick Strategy form does (one lazy chunk per template). */
const loadTemplate = async (name: string): Promise<string> => (await import(/* webpackChunkName: "[request]" */ `../../xml/${name}.xml`)).default;

/** Bot Builder XML for a finished bot. */
export const buildBotXml = async (spec: BotSpec): Promise<string> => {
    if (spec.adv) {
        const a = toAdv(spec);
        const problems = validateAdv(a);
        if (problems.length) throw new Error(problems.join(' '));
        return buildAdvancedXml(a);
    }
    return applySpec(await loadTemplate(templateName(spec)), spec);
};
