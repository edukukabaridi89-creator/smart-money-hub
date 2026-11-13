import { MARKETS, NO_LIMIT } from './bot-spec';
import type { DigitOp, Draft, Entry, Progression, Side } from './bot-spec';

export type Slot = 'symbol' | 'side' | 'barrier' | 'stake' | 'duration' | 'progression' | 'multiplier' | 'unit' | 'maxStake' | 'takeProfit' | 'stopLoss' | 'entry' | 'entryDigit' | 'advanced' | 'recoverKind' | 'recoverSide' | 'recoverBarrier' | 'switchAfter' | 'switchMarkets';

const WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const W = Object.keys(WORDS).join('|');
const NUM = '\\$?\\s*(\\d+(?:\\.\\d+)?)';
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';

/** Lower-cases and turns spoken numbers into digits ("zero point five" -> 0.5, "five dollars" -> $5). */
export const normalize = (raw: string): string => {
    let t = ` ${raw.toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'")} `;
    t = t.replace(/(\d),(\d{3})\b/g, '$1$2');
    t = t.replace(/\b(?:(?:one|a)\s+)?hundred\b/g, ' 100 '); // "one hundred" / "a hundred" -> 100
    t = t.replace(new RegExp(`\\b(${TENS})[\\s-]+(one|two|three|four|five|six|seven|eight|nine)\\b`, 'g'), (_m, a, b) => String(WORDS[a] + WORDS[b]));
    t = t.replace(new RegExp(`\\b(?:(${W})\\s+)?point\\s+((?:(?:${W}|\\d)\\s*)+)`, 'g'), (_m, whole, frac) => ` ${whole ? WORDS[whole] : 0}.${frac.trim().split(/\s+/).map((x: string) => WORDS[x] ?? x).join('')} `);
    t = t.replace(new RegExp(`\\b(${W})\\b`, 'g'), (_m, x) => String(WORDS[x]));
    t = t.replace(/(\d+(?:\.\d+)?)\s*(?:dollars?|usd|bucks)\b/g, (_m, n) => `$${n}`);
    t = t.replace(/\b(\d+) and a half\b/g, (_m, n) => `${n}.5`);
    return t;
};

/** Removes the first match of `re` from `t` and returns what it captured. */
const take = (t: string, re: RegExp): { t: string; m: RegExpMatchArray | null } => {
    const m = t.match(re);
    return m ? { t: t.replace(m[0], ' '), m } : { t, m: null };
};

const parseMarket = (t: string) => {
    let r = take(t, /\b1hz\s*(\d{2,3})\s*v\b/);
    if (r.m) return { t: r.t, id: `1HZ${r.m[1]}V` };
    r = take(t, /\br_(\d{2,3})\b/);
    if (r.m) return { t: r.t, id: `R_${r.m[1]}` };
    r = take(t, /\b(?:volatility|vol|v)\s*(?:index\s*)?(\d{2,3})\b(\s*\(?\s*1\s*-?\s*s(?:ec(?:ond)?s?)?\b\)?)?/);
    if (r.m) {
        const n = r.m[1], one = !!r.m[2];
        const id = one || ['15', '30', '90'].includes(n) ? `1HZ${n}V` : `R_${n}`;
        if (MARKETS.some(x => x.id === id)) return { t: r.t, id };
    }
    return { t, id: undefined as string | undefined };
};

const parseEntry = (t: string): { t: string; entry?: Entry } => {
    let r = take(t, /\b(?:wait(?:ing)?\s+(?:for|until)|enter(?:ing)?\s+(?:when|on|after)|trade\s+(?:only\s+)?when|only\s+(?:when|trade\s+when)|when|until|trigger(?:s|ed)?\s+(?:on|when)|start\s+(?:when|on))\s+(?:the\s+)?(?:last\s+)?digit\s*(?:is|=|equals?|lands?\s+on|shows?|of)?\s*(over|above|greater than|>|under|below|less than|<)?\s*(\d)\b/);
    if (r.m) {
        const w = r.m[1] ?? '';
        const op: DigitOp = /over|above|greater|>/.test(w) ? 'GT' : /under|below|less|</.test(w) ? 'LT' : 'EQ';
        return { t: r.t, entry: { mode: 'digit', op, digit: Number(r.m[2]) } };
    }
    r = take(t, /\b(?:wait(?:ing)?\s+for\s+(?:a\s+|the\s+)?(?:last\s+)?digit|enter\s+on\s+(?:a\s+)?(?:last\s+)?digit|digit\s+(?:condition|trigger))\b/);
    if (r.m) return { t: r.t, entry: { mode: 'digit' } };
    r = take(t, /\b(?:every\s+tick|each\s+tick|immediately|straight\s+away|right\s+away|no\s+(?:entry\s+)?condition|trade\s+all\s+the\s+time)\b/);
    if (r.m) return { t: r.t, entry: { mode: 'any' } };
    return { t };
};

const parseSide = (t: string): { t: string; side?: Side; barrier?: number } => {
    const digitFirst: [RegExp, Side][] = [
        [/\b(?:over|above|higher than|greater than)\s*(\d)\b/, 'DIGITOVER'],
        [/\b(?:under|below|lower than|less than)\s*(\d)\b/, 'DIGITUNDER'],
        [/\b(?:differ|differs|different|diff)\s*(?:from|than|to)?\s*(\d)\b/, 'DIGITDIFF'],
        [/\b(?:match|matches|matching)\s*(?:the\s*)?(\d)\b/, 'DIGITMATCH'],
    ];
    for (const [re, side] of digitFirst) {
        const r = take(t, re);
        if (r.m) return { t: r.t, side, barrier: Number(r.m[1]) };
    }
    const bare: [RegExp, Side][] = [
        [/\b(?:over|above)\b/, 'DIGITOVER'], [/\b(?:under|below)\b/, 'DIGITUNDER'], [/\b(?:differ|differs|different)\b/, 'DIGITDIFF'], [/\b(?:match|matches|matching)\b/, 'DIGITMATCH'],
    ];
    for (const [re, side] of bare) {
        const r = take(t, re);
        if (r.m) return { t: r.t, side };
    }
    const hasEven = /\beven\b/.test(t), hasOdd = /\bodd\b/.test(t);
    if (hasEven !== hasOdd) return { t: t.replace(/\b(?:even|odd)\b/, ' '), side: hasEven ? 'DIGITEVEN' : 'DIGITODD' };
    const up = take(t, /\b(?:rise|rises|call)\b|\bhigher\b(?!\s+than)/);
    if (up.m) return { t: up.t, side: 'CALL' };
    const down = take(t, /\b(?:fall|falls|put)\b|\blower\b(?!\s+than)/);
    if (down.m) return { t: down.t, side: 'PUT' };
    return { t };
};

const parseProgression = (t: string): { t: string; progression?: Progression; multiplier?: number; unit?: number } => {
    const out: { progression?: Progression; multiplier?: number; unit?: number } = {};
    let r;
    if ((r = take(t, /\b(?:no\s+martingale|no\s+progression|flat\s+(?:stake|betting)?|fixed\s+stake|same\s+stake|constant\s+stake|keep\s+(?:the\s+)?stake(?:\s+the)?\s+same|don'?t\s+(?:change|increase)\s+(?:the\s+)?stake)\b/)).m) { out.progression = 'flat'; t = r.t; }
    else if ((r = take(t, /\b(?:reverse|anti)[\s-]*martingale\b/)).m) { out.progression = 'reverse_martingale'; t = r.t; }
    else if ((r = take(t, /\b(?:reverse|anti)[\s-]*d'?\s?alembert\b/)).m) { out.progression = 'reverse_dalembert'; t = r.t; }
    else if ((r = take(t, /\bmartingale\b/)).m) { out.progression = 'martingale'; t = r.t; }
    else if ((r = take(t, /\bd'?\s?alembert\b/)).m) { out.progression = 'dalembert'; t = r.t; }
    else if ((r = take(t, /\boscar'?s?(?:\s+grind)?\b/)).m) { out.progression = 'oscars_grind'; t = r.t; }
    else if ((r = take(t, /\b1[\s-]?3[\s-]?2[\s-]?6\b/)).m) { out.progression = 'one_three_two_six'; t = r.t; }
    const dbl = t.match(/\b(double|triple)\b/);
    if (dbl && /\b(?:loss|lose|lost|losing|losses)\b/.test(t)) {
        out.multiplier = dbl[1] === 'double' ? 2 : 3;
        if (!out.progression) out.progression = 'martingale';
        t = t.replace(dbl[0], ' ');
    }
    if ((r = take(t, new RegExp(`\\b(?:multiplier|multiply(?:ing)?(?:\\s+(?:it|the stake|stake))?(?:\\s+by)?|by|of|times|x|×)\\s*${NUM}\\s*x?|${NUM}\\s*x\\b`))).m && (out.progression === 'martingale' || out.progression === 'reverse_martingale' || /martingale|multipl/.test(t + ' '))) {
        out.multiplier = Number(r.m![1] ?? r.m![2]); t = r.t;
    }
    if ((r = take(t, new RegExp(`\\bunits?\\s*(?:of|is|at|=|:)?\\s*${NUM}|${NUM}\\s*units?\\b`))).m) { out.unit = Number(r.m![1] ?? r.m![2]); t = r.t; }
    return { t, ...out };
};


/** All volatilities named in the text, in order, without duplicates. */
const allMarkets = (text: string): string[] => {
    let t = normalize(text);
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) {
        const m = parseMarket(t);
        if (!m.id) break;
        if (!ids.includes(m.id)) ids.push(m.id);
        t = m.t;
    }
    return ids;
};

const SIDE_WORD = 'even|odd|(?:over|above|under|below)\\s*\\d?|differs?|matches?|rise|fall|opposite(?:\\s+side|\\s+trade)?';
const PAIR = 'even\\s*(?:or|/|and|vs)\\s*odd|odd\\s*(?:or|/|and|vs)\\s*even|over\\s*(?:or|/|and|vs)\\s*under|under\\s*(?:or|/|and|vs)\\s*over';
const PROB = '(?:probab\\w*|likel\\w+|more\\s+often|most\\s+(?:often|frequent\\w*)|higher\\s+(?:chance|odds)|best\\s+(?:chance|odds)|chance)';

/** Recovery, "best of two" and market-switching phrases. Removes what it used from `t`. */
const parseAdvanced = (t: string, primaryHint?: boolean): { t: string; patch: Draft } => {
    const patch: Draft = {};
    let r;
    // recovery: "recover on odd", "recover with even or odd depending on probability", "recover the opposite"
    if ((r = take(t, new RegExp(`\\b(?:recover(?:y|ing|s)?|recoup|win it back|get it back|(?:after|on|when)\\s+(?:a\\s+)?(?:loss(?:es)?|lose|losing))\\s*(?:it\\s+)?(?:on|with|using|via|by|into|the|to|trade|trading|switch(?:ing)?\\s+to)*\\s*(${PAIR})(?:\\s+(?:depending|based|according|going|whichever|by)\\b[^.,;]*?${PROB}[^.,;]*)?`))).m) {
        patch.advanced = true; patch.recover = 'best';
        patch.recoverFamily = /even|odd/.test(r.m![1]) ? 'evenodd' : 'overunder';
        t = r.t;
    } else if ((r = take(t, new RegExp(`\\b(?:recover(?:y|ing|s)?|recoup|win it back|get it back)\\s*(?:it\\s+)?(?:on|with|using|via|by|into|the|to|trade|trading|switch(?:ing)?\\s+to)*\\s*(${SIDE_WORD})(?:\\s*(\\d))?`))).m) {
        const w = r.m![1];
        patch.advanced = true;
        if (/opposite/.test(w)) patch.recover = 'opposite';
        else {
            const sd = parseSide(normalize(`${w} ${r.m![2] ?? ''}`));
            if (sd.side) { patch.recover = 'fixed'; patch.recoverSide = sd.side; if (sd.barrier !== undefined) patch.recoverBarrier = sd.barrier; }
            else patch.recover = 'ask';
        }
        t = r.t;
    } else if ((r = take(t, /\b(?:recover(?:y|ing|s)?|recoup|win it back|get it back)\b/)).m) {
        patch.advanced = true; patch.recover = 'ask'; t = r.t;
    }
    // choose the likelier side every trade: "even or odd depending on the probability"
    const pair = t.match(new RegExp(`(${PAIR})`));
    if (pair && new RegExp(PROB).test(t) && !patch.recover) {
        patch.advanced = true; patch.pickBest = true;
        const first = /^(even|odd|over|under)/.exec(pair[1])![1];
        patch.side = ({ even: 'DIGITEVEN', odd: 'DIGITODD', over: 'DIGITOVER', under: 'DIGITUNDER' } as const)[first as 'even'];
        t = t.replace(pair[0], ' ');
    } else if (!patch.recover && new RegExp(`\\b(?:pick|choose|select|trade)\\s+(?:the\\s+)?(?:side|one|option)?\\s*(?:with|that has|by)?\\s*(?:the\\s+)?${PROB}`).test(t) && primaryHint !== false) {
        patch.advanced = true; patch.pickBest = true;
    }
    // market switching: "change volatility on loss", "switch market after 2 losses", "rotate between vol 10, vol 25 and vol 50"
    if ((r = take(t, /\b(?:change|switch|move|rotate|jump|hop|cycle)\w*\s+(?:the\s+)?(?:between\s+)?(?:volatilit\w*|vol|markets?|index|indices|symbols?)\b(?:\s+(?:on|after|when|if|every)\s+(?:(?:a|an|the|each|every)\s+)?(?:(\d+)\s+)?(?:consecutive\s+)?(?:loss(?:es)?|lose|losing|lost))?/)).m) {
        patch.advanced = true; patch.switchAsk = true;
        if (/loss|lose|lost/.test(r.m![0])) patch.switchAfter = r.m![1] ? Number(r.m![1]) : 1;
        t = r.t;
        if (patch.switchAfter === undefined && (r = take(t, /\b(?:after|every|when)\s+(?:(\d+)\s+)?(?:consecutive\s+)?(?:loss(?:es)?|lose|losing|lost)/)).m) { patch.switchAfter = r.m![1] ? Number(r.m![1]) : 1; t = r.t; }
    }
    return { t, patch };
};

/** Reads everything it can recognise out of free text or speech. Values are not validated here. */
/** `looseStake`: treat a lone "$5" as the stake (only sensible in a free opening sentence, not as an answer to another question). */
export const extract = (raw: string, opts: { looseStake?: boolean } = { looseStake: true }): Draft => {
    const patch: Draft = {};
    const nm = raw.match(/\b(?:call it|call the bot|call this bot|named|name it|name this|name:|called|title it)\s*[:\-]?\s*["“']?([^"”'\n,.;]{2,40})/i);
    if (nm) patch.name = nm[1].trim();
    let t = normalize(nm ? raw.replace(nm[0], ' ') : raw);

    // markets named for switching are read from the whole sentence before the first one is taken as the start market
    const marketList = allMarkets(t);
    const ad = parseAdvanced(t); t = ad.t; Object.assign(patch, ad.patch);
    const mk = parseMarket(t); t = mk.t; if (mk.id) patch.symbol = mk.id;
    if (patch.switchAsk) {
        const rest = marketList.filter(m => m !== patch.symbol);
        if (rest.length) patch.switchMarkets = rest;
    }
    const en = parseEntry(t); t = en.t; if (en.entry) patch.entry = en.entry;

    let r;
    if ((r = take(t, /\b(?:no|without)\s+(?:max(?:imum)?\s+stake|stake\s+cap|cap)\b/)).m) { patch.maxStake = null; t = r.t; }
    else if ((r = take(t, new RegExp(`(?:max(?:imum)?\\s+stake|stake\\s+cap|cap(?:ped)?\\s+(?:the\\s+)?stake(?:\\s+at)?|stake\\s+(?:limit|ceiling))\\s*(?:of|is|at|to|=|:)?\\s*${NUM}`))).m) { patch.maxStake = Number(r.m![1]); t = r.t; }

    if ((r = take(t, /\b(?:no|without)\s+(?:take[\s-]?profit|tp|profit\s+target)\b/)).m) { patch.takeProfit = NO_LIMIT; t = r.t; }
    else if ((r = take(t, new RegExp(`(?:take[\\s-]?profit|\\btp\\b|profit\\s+target|target\\s+profit|\\btarget\\b)\\s*(?:of|is|at|to|=|:)?\\s*${NUM}`))).m) { patch.takeProfit = Number(r.m![1]); t = r.t; }
    else if ((r = take(t, new RegExp(`\\b(?:stop|close|end)\\s+(?:the\\s+bot\\s+)?(?:at|when|after|once)\\s+(?:i\\s+|it\\s+|total\\s+)?(?:make|makes|win|wins|profit|profits|reach|reaches|hits?)\\s*(?:of|is|at|to)?\\s*${NUM}`))).m) { patch.takeProfit = Number(r.m![1]); t = r.t; }

    if ((r = take(t, /\b(?:no|without)\s+(?:stop[\s-]?loss|sl|loss\s+limit)\b/)).m) { patch.stopLoss = NO_LIMIT; t = r.t; }
    else if ((r = take(t, new RegExp(`(?:stop[\\s-]?loss|\\bsl\\b|max(?:imum)?\\s+loss|loss\\s+limit)\\s*(?:of|is|at|to|=|:)?\\s*${NUM}`))).m) { patch.stopLoss = Number(r.m![1]); t = r.t; }
    else if ((r = take(t, new RegExp(`\\b(?:stop|close|end)\\s+(?:the\\s+bot\\s+)?(?:at|when|after|once|if)\\s+(?:i\\s+|it\\s+)?(?:lose|loses|lost|loss(?:es)?)\\s*(?:of|is|at|to)?\\s*${NUM}`))).m) { patch.stopLoss = Number(r.m![1]); t = r.t; }

    const sd = parseSide(t); t = sd.t; if (sd.side && !(patch.pickBest && patch.side)) patch.side = sd.side; if (sd.barrier !== undefined) patch.barrier = sd.barrier;

    if ((r = take(t, /\b(\d+)\s*ticks?\b/)).m) { patch.duration = Number(r.m![1]); t = r.t; }
    else if ((r = take(t, /\bduration\s*(?:of|is|at|=|:)?\s*(\d+)\b/)).m) { patch.duration = Number(r.m![1]); t = r.t; }

    const pg = parseProgression(t); t = pg.t;
    if (pg.progression) patch.progression = pg.progression;
    if (pg.multiplier !== undefined) patch.multiplier = pg.multiplier;
    if (pg.unit !== undefined) patch.unit = pg.unit;

    if ((r = take(t, new RegExp(`(?:stake|bet|amount|per\\s+trade|each\\s+trade|trade\\s+with|trading\\s+with|using)\\s*(?:of|is|at|=|:|with)?\\s*${NUM}`))).m) { patch.stake = Number(r.m![1]); t = r.t; }
    else if ((r = take(t, new RegExp(`${NUM}\\s*(?:stake|per\\s+trade|each\\s+trade|a\\s+trade)\\b`))).m) { patch.stake = Number(r.m![1]); t = r.t; }
    else if (opts.looseStake && (r = take(t, /\$\s*(\d+(?:\.\d+)?)/)).m) { patch.stake = Number(r.m![1]); t = r.t; }
    return patch;
};

const num = (t: string) => {
    const m = normalize(t).match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : undefined;
};
const PROB_RE = new RegExp(PROB);
const none = (t: string) => /^\s*(?:no|none|nope|skip|nothing|no limit|no cap|not needed|don'?t need)\b/.test(t.toLowerCase());

/** Reads a short reply to the question that was just asked (e.g. "0.5" when asked for the stake). */
export const parseAnswer = (slot: Slot, text: string): Draft => {
    const n = normalize(text);
    switch (slot) {
        case 'symbol': {
            const m = n.match(/^\s*(?:volatility\s*)?(\d{2,3})\s*(\(?\s*1\s*-?\s*s\)?)?\s*$/);
            if (!m) return {};
            const id = m[2] || ['15', '30', '90'].includes(m[1]) ? `1HZ${m[1]}V` : `R_${m[1]}`;
            return MARKETS.some(x => x.id === id) ? { symbol: id } : {};
        }
        case 'side': return (({ side, barrier }) => ({ side, barrier }))(parseSide(n));
        case 'barrier': { const m = n.match(/\b(\d)\b/); return m ? { barrier: Number(m[1]) } : {}; }
        case 'stake': { const v = num(text); return v === undefined ? {} : { stake: v }; }
        case 'duration': { const v = num(text); return v === undefined ? {} : { duration: v }; }
        case 'multiplier': { const v = num(text); return v === undefined ? {} : { multiplier: v }; }
        case 'unit': { const v = num(text); return v === undefined ? {} : { unit: v }; }
        case 'progression': { const p = parseProgression(n); return none(text) ? { progression: 'flat' } : { progression: p.progression, multiplier: p.multiplier, unit: p.unit }; }
        case 'maxStake': { if (none(text)) return { maxStake: null }; const v = num(text); return v === undefined ? {} : { maxStake: v }; }
        case 'takeProfit': { if (none(text)) return { takeProfit: NO_LIMIT }; const v = num(text); return v === undefined ? {} : { takeProfit: v }; }
        case 'stopLoss': { if (none(text)) return { stopLoss: NO_LIMIT }; const v = num(text); return v === undefined ? {} : { stopLoss: v }; }
        case 'entry': {
            if (/\b(?:every|each|any|always|immediately|now|no condition|straight)\b/.test(n)) return { entry: { mode: 'any' } };
            if (/\b(?:wait|digit|condition|trigger)\b/.test(n)) {
                const m = n.match(/(over|above|greater|>|under|below|less|<|equals?|is|=)?\s*(\d)\b/);
                if (m) return { entry: { mode: 'digit', op: /over|above|greater|>/.test(m[1] ?? '') ? 'GT' : /under|below|less|</.test(m[1] ?? '') ? 'LT' : 'EQ', digit: Number(m[2]) } };
                return { entry: { mode: 'digit' } };
            }
            return {};
        }
        case 'advanced': {
            if (none(text) || /\b(?:simple|plain|basic|nothing|no thanks)\b/.test(n)) return { advanced: true };
            const a = parseAdvanced(n).patch;
            if (/\b(?:recover|opposite)\b/.test(n) && !a.recover) a.recover = 'ask';
            if (/\b(?:switch|change|rotate|volatilit\w*|market)\b/.test(n) && !a.switchAsk) a.switchAsk = true;
            if (PROB_RE.test(n) && !a.recover) a.pickBest = true;
            return Object.keys(a).length ? { ...a, advanced: true } : {};
        }
        case 'recoverKind': {
            if (/opposite|other side|reverse/.test(n)) return { recover: 'opposite' };
            const fam = n.match(new RegExp(`(${PAIR})`));
            if (fam || PROB_RE.test(n)) {
                const family = fam ? (/even|odd/.test(fam[1]) ? 'evenodd' : 'overunder') : /over|under/.test(n) ? 'overunder' : 'evenodd';
                const b = n.match(/\b(\d)\b/);
                return { recover: 'best', recoverFamily: family, ...(b && family === 'overunder' ? { recoverBarrier: Number(b[1]) } : {}) };
            }
            if (/specific|fixed|particular|another|different/.test(n)) return { recover: 'fixed' };
            const sd = parseSide(n);
            return sd.side ? { recover: 'fixed', recoverSide: sd.side, ...(sd.barrier !== undefined ? { recoverBarrier: sd.barrier } : {}) } : {};
        }
        case 'recoverSide': {
            const sd = parseSide(n);
            return sd.side ? { recoverSide: sd.side, ...(sd.barrier !== undefined ? { recoverBarrier: sd.barrier } : {}) } : {};
        }
        case 'recoverBarrier': { const m = n.match(/\b(\d)\b/); return m ? { recoverBarrier: Number(m[1]) } : {}; }
        case 'switchAfter': { const v = num(text); return v === undefined ? (/\b(?:every|each|any|first|a)\s+loss/.test(n) ? { switchAfter: 1 } : {}) : { switchAfter: v }; }
        case 'switchMarkets': { const ids = allMarkets(text); return ids.length ? { switchMarkets: ids } : {}; }
        case 'entryDigit': {
            const m = n.match(/(over|above|greater|>|under|below|less|<|equals?|is|=)?\s*(\d)\b/);
            if (!m) return {};
            return { entry: { mode: 'digit', op: /over|above|greater|>/.test(m[1] ?? '') ? 'GT' : /under|below|less|</.test(m[1] ?? '') ? 'LT' : 'EQ', digit: Number(m[2]) } };
        }
    }
};
