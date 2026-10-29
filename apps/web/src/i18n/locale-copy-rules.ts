export type TCopyRule = 'dash' | 'banned-word' | 'english-literal' | 'gendered-word';

export interface ICopyViolation {
  readonly path: string;
  readonly rule: TCopyRule;
}

const DASH_PATTERN = /[–—]/;

// "troca" outside a deck reads as trading cards: only the namespaces that
// speak to a player who is not looking at a deck are covered.
const TROCA_NAMESPACES: ReadonlySet<string> = new Set(['home', 'auth', 'onboarding']);
const TROCA_PATTERN = /(?<![\p{L}\p{N}])trocas?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])trocar(?![\p{L}\p{N}])/iu;

// Words that give the player a gender; the copy says the result instead ("A conta fica aberta neste celular").
export const GENDERED_WORDS: readonly string[] = [
  'bem-vindo',
  'bem-vinda',
  'conectado',
  'conectada',
  'logado',
  'logada',
];
const GENDERED_PATTERN = new RegExp(`(?<![\\p{L}\\p{N}-])(?:${GENDERED_WORDS.join('|')})(?![\\p{L}\\p{N}-])`, 'iu');

const ENGLISH_LITERALS: readonly string[] = ['Manual entries', 'Attack Actions'];

/** Returns the rules a single pt-BR value breaks; `namespace` is the top-level catalog key. */
export function findCopyViolations(namespace: string, value: string): readonly ICopyViolation[] {
  const violations: ICopyViolation[] = [];
  if (DASH_PATTERN.test(value)) violations.push({ path: namespace, rule: 'dash' });
  if (TROCA_NAMESPACES.has(namespace) && TROCA_PATTERN.test(value)) {
    violations.push({ path: namespace, rule: 'banned-word' });
  }
  if (GENDERED_PATTERN.test(value)) violations.push({ path: namespace, rule: 'gendered-word' });
  if (ENGLISH_LITERALS.some((literal) => value.includes(literal))) {
    violations.push({ path: namespace, rule: 'english-literal' });
  }
  return violations;
}

function walk(node: unknown, path: readonly string[]): readonly ICopyViolation[] {
  if (typeof node === 'string') {
    return findCopyViolations(path[0] ?? '', node).map((v) => ({ ...v, path: path.join('.') }));
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, child]) => walk(child, [...path, key]));
  }
  return [];
}

/** Walks every leaf string of a catalog and lists `namespace.key` for each violation. */
export function scanCatalog(catalog: Readonly<Record<string, unknown>>): readonly ICopyViolation[] {
  return walk(catalog, []);
}
