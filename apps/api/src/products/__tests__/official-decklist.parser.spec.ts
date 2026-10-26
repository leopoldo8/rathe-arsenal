import { catalog } from '@rathe-arsenal/engine';
import { buildProductFile, extractOfficialCards } from '../official-decklist.parser';

const URL = 'https://fabtcg.com/decklists/kayo-armory-deck/';

function page(items: ReadonlyArray<readonly [number, string]>): string {
  const rows = items
    .map(([quantity, name]) => `<li class="card-item group"><div class="card-name"><span>${quantity}x</span> ${name}</div></li>`)
    .join('\n');
  return `<html><head><title>Armory Deck - Kayo, Armed and Dangerous - Flesh and Blood TCG</title></head><body><ul>${rows}</ul></body></html>`;
}

describe('official decklist parser', () => {
  it('reads an official decklist, drops tokens and lists differences', () => {
    const html = page([
      [1, 'Kayo, Armed and Dangerous'],
      [3, 'Bare Fangs (red)'],
      [3, 'Bare Fangs (yel)'],
      [2, 'Agility'],
      [2, 'Might'],
      [1, 'Snatch (red)'],
      [1, 'Not A Real Card'],
    ]);

    const read = extractOfficialCards(html);
    const { file, differences } = buildProductFile(html, URL, catalog);

    expect(read.slice(0, 2)).toEqual([
      { name: 'Kayo, Armed and Dangerous', pitch: null, quantity: 1 },
      { name: 'Bare Fangs', pitch: 1, quantity: 3 },
    ]);
    expect(file).toMatchObject({
      key: 'armory-kayo',
      name: 'Armory Deck: Kayo',
      kind: 'armory',
      format: 'Classic Constructed',
      hero: 'kayo-armed-and-dangerous',
    });
    expect(file.cards).toEqual([
      { cardIdentifier: 'kayo-armed-and-dangerous', printingCode: 'AKO001', quantity: 1 },
      { cardIdentifier: 'bare-fangs-red', printingCode: 'AKO007', quantity: 3 },
      { cardIdentifier: 'bare-fangs-yellow', printingCode: 'AKO016', quantity: 3 },
    ]);
    expect(file.cards.map((card) => card.cardIdentifier)).not.toContain('agility');
    const notOnThePage = [
      'Agile Windup (blue)',
      'Assault and Battery (blue)',
      'Battlefront Bastion (blue)',
      'Beaten Trackers',
      'Clash of Agility (red)',
      'Hide Tanner',
      'Humble (red)',
      'Knucklehead',
      'Mandible Claw',
      'Mighty Windup (blue)',
      'Pound Town (blue)',
      'Pulping (red)',
      'Rally the Rearguard (red)',
      'Reincarnate (blue)',
      'Riled Up (blue)',
      'Run Roughshod (blue)',
      'Savage Beatdown (red)',
      'Savage Sash',
      'Smash Instinct (blue)',
      'Strength Rules All (red)',
      'Wild Ride (red)',
      'Wreck Havoc (red)',
      'Wrecker Romp (blue)',
    ];
    expect(differences).toEqual([
      'no printing tagged with Armory Deck: Kayo: Snatch (red)',
      'not in the catalog: Not A Real Card',
      ...notOnThePage.map((name) => `in the catalog for Armory Deck: Kayo, not on the page: ${name}`),
    ]);
  });

  it('lists nothing when the page matches the catalog', () => {
    const html = page([
      [1, 'Kayo, Armed and Dangerous'],
      [1, 'Beaten Trackers'],
      [1, 'Hide Tanner'],
      [1, 'Knucklehead'],
      [1, 'Mandible Claw'],
      [1, 'Savage Sash'],
      ...['Bare Fangs (red)', 'Clash of Agility (red)', 'Humble (red)', 'Pulping (red)', 'Rally the Rearguard (red)', 'Savage Beatdown (red)', 'Strength Rules All (red)', 'Wild Ride (red)', 'Wreck Havoc (red)', 'Bare Fangs (yel)', 'Agile Windup (blu)', 'Assault and Battery (blu)', 'Battlefront Bastion (blu)', 'Mighty Windup (blu)', 'Pound Town (blu)', 'Reincarnate (blu)', 'Riled Up (blu)', 'Run Roughshod (blu)', 'Smash Instinct (blu)', 'Wrecker Romp (blu)'].map((name): readonly [number, string] => [3, name]),
    ]);

    const { file, differences } = buildProductFile(html, URL, catalog);

    expect(differences).toEqual([]);
    expect(file.cards).toHaveLength(26);
    expect(file.cards.reduce((sum, card) => sum + card.quantity, 0)).toBe(66);
  });

  it('refuses an address that is not a decklist of a known kind', () => {
    expect(() => buildProductFile(page([]), 'https://example.com/other', catalog)).toThrow(/not an Armory, Blitz or Silver Age/);
  });
});
