import { makeAutoObservable } from 'mobx';
import { buildBotXml } from './studio/templates';
import type { BotSpec } from './studio/bot-spec';

const KEY = 'nexus_my_bots';
/** A saved bot lives only in this browser (localStorage). Studio bots keep their settings and are rebuilt on open; workspace saves keep their XML. */
export type SavedBot = { id: string; name: string; createdAt: number; source: 'studio' | 'workspace'; spec?: BotSpec; xml?: string };

const read = (): SavedBot[] => {
    try {
        const v = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(v) ? v.filter(b => b?.id && b?.name && (b.spec || b.xml)) : [];
    } catch {
        return [];
    }
};

class MyBotsStore {
    bots: SavedBot[] = read();
    constructor() {
        makeAutoObservable(this);
    }
    private persist() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.bots));
            return true;
        } catch {
            return false; // storage full or blocked
        }
    }
    /** Returns false (and keeps the list unchanged) if the browser can't store it. */
    add = (bot: Omit<SavedBot, 'id' | 'createdAt'>): SavedBot | null => {
        const saved: SavedBot = { ...bot, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() };
        const prev = this.bots;
        this.bots = [saved, ...prev];
        if (this.persist()) return saved;
        this.bots = prev;
        return null;
    };
    remove = (id: string) => {
        this.bots = this.bots.filter(b => b.id !== id);
        this.persist();
    };
    xmlOf = async (b: SavedBot): Promise<string> => (b.spec ? buildBotXml(b.spec) : (b.xml as string));
}
export const myBots = new MyBotsStore();
