import { DBOT_TABS } from '@/constants/bot-contents';
import { load, save_types } from '@/external/bot-skeleton';
import { nexus } from './store';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const waitFor = async <T,>(fn: () => T, ms = 10000): Promise<T | undefined> => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        const v = fn();
        if (v) return v;
        await sleep(150);
    }
};

/**
 * Opens Bot Builder and imports the XML through the app's own loader (same path as File > Import: legacy block
 * conversion + validation). The loader returns nothing when Bot Builder isn't ready yet, so success is verified by
 * checking the workspace actually changed, and the load is retried a few times.
 */
export const openXmlInBotBuilder = async (xml: string, title: string): Promise<boolean> => {
    nexus.goTab(DBOT_TABS.BOT_BUILDER);
    const workspace: any = await waitFor(() => (window as any).Blockly?.derivWorkspace);
    if (!workspace) {
        nexus.log('Bot Builder is still loading, please try again in a moment.');
        return false;
    }
    const before = workspace.current_strategy_id;
    for (let attempt = 0; attempt < 5; attempt++) {
        const res: any = await load({ block_string: xml, file_name: title, workspace, from: save_types.LOCAL, drop_event: null, strategy_id: null, showIncompatibleStrategyDialog: null });
        if (res?.error) {
            nexus.log(`Could not open "${title}": ${res.error}`);
            return false;
        }
        if (workspace.current_strategy_id !== before && workspace.getAllBlocks().length > 0) {
            nexus.pullSymbol(); // keep DCircles / Manual / Hedge on the market the bot just loaded
            return true;
        }
        await sleep(600);
    }
    nexus.log(`Could not open "${title}". Please try again.`);
    return false;
};

/** XML of whatever is on the Bot Builder canvas right now (same attributes the app's own Save uses), or null if it is empty. */
export const currentWorkspaceXml = (): string | null => {
    const B = (window as any).Blockly;
    const ws = B?.derivWorkspace;
    if (!ws || !ws.getAllBlocks().length) return null;
    const dom = B.Xml.workspaceToDom(ws, true);
    dom.setAttribute('is_dbot', 'true');
    dom.setAttribute('collection', 'false');
    return B.Xml.domToText(dom);
};
