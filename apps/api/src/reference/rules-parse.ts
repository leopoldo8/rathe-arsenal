export const RULES_BASE_URL = 'https://rules.fabtcg.com/en/';

export interface IRulesIndexDoc {
  readonly location: string;
  readonly title: string;
  readonly text: string;
}

export interface IParsedRule {
  readonly ruleNumber: string;
  readonly sectionNumber: string;
  readonly sectionTitle: string;
  readonly text: string;
  readonly url: string;
}

const RULE_START = /^(\d+(?:\.\d+)+[a-z]?)\s/;
const GLOSSARY_TERM = /^1\.-1\.\d+\s+(.+?)§?$/;
const SECTION_TITLE = /^(\d+\.\d+)\s+(.+)$/;
const ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

function toPlainText(html: string): string {
  return html
    .replace(/<sup>\s*\[([^\]]*)\]\s*<\/sup>/g, ' [$1]')
    .replace(/<li>/g, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole)
    .replace(/§/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function blocks(html: string): string[] {
  return [...html.matchAll(/<(p|ul)>([\s\S]*?)<\/\1>/g)].map((match) => toPlainText(match[0])).filter(Boolean);
}

function glossaryEntries(doc: IRulesIndexDoc): IParsedRule[] {
  const entries: IParsedRule[] = [];
  for (const block of blocks(doc.text)) {
    const term = GLOSSARY_TERM.exec(block);
    if (term?.[1]) {
      entries.push({
        ruleNumber: `Glossary: ${term[1].trim()}`,
        sectionNumber: 'glossary',
        sectionTitle: 'Glossary',
        text: '',
        url: `${RULES_BASE_URL}${doc.location}`,
      });
      continue;
    }
    const last = entries[entries.length - 1];
    if (last) entries[entries.length - 1] = { ...last, text: last.text ? `${last.text}\n${block}` : block };
  }
  return entries.filter((entry) => entry.text);
}

function sectionEntries(doc: IRulesIndexDoc): IParsedRule[] {
  const title = SECTION_TITLE.exec(doc.title.trim());
  if (!title?.[1] || !title[2]) return [];
  const entries: IParsedRule[] = [];
  for (const block of blocks(doc.text)) {
    const start = RULE_START.exec(block);
    if (start?.[1]) {
      entries.push({
        ruleNumber: start[1],
        sectionNumber: title[1],
        sectionTitle: title[2],
        text: block,
        url: `${RULES_BASE_URL}${doc.location}`,
      });
      continue;
    }
    const last = entries[entries.length - 1];
    if (last) entries[entries.length - 1] = { ...last, text: `${last.text}\n${block}` };
  }
  return entries;
}

/** One entry per numbered rule of the comprehensive rules (`cr/`) and one per glossary term; later duplicates are dropped. */
export function parseRulesIndex(index: { readonly docs?: readonly IRulesIndexDoc[] }): IParsedRule[] {
  const byNumber = new Map<string, IParsedRule>();
  for (const doc of index.docs ?? []) {
    if (!doc.location.startsWith('cr/') || doc.location.startsWith('cr/acknowledgments/')) continue;
    const entries = doc.location.startsWith('cr/glossary/') ? glossaryEntries(doc) : sectionEntries(doc);
    for (const entry of entries) if (!byNumber.has(entry.ruleNumber)) byNumber.set(entry.ruleNumber, entry);
  }
  return [...byNumber.values()];
}
