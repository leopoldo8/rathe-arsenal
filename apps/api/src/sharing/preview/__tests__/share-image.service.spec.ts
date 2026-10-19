import { existsSync } from 'fs';
import { FONTS } from '../image-layout';
import { toFileSlug } from '../share-image.service';

describe('toFileSlug', () => {
  it.each([
    ['Lâminas de Ironsong', 'laminas-de-ironsong'],
    ['  Blades / "of" <b>Fury</b>  ', 'blades-of-b-fury-b'],
    ['', 'rathe-arsenal'],
    ['???', 'rathe-arsenal'],
  ])('turns %j into %j', (name, slug) => {
    expect(toFileSlug(name)).toBe(slug);
  });

  it('keeps the slug short enough for a filename and never ends on a dash', () => {
    const slug = toFileSlug(`${'a'.repeat(59)} bbbbbb`);

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('bundled fonts', () => {
  it.each(Object.values(FONTS).map((font) => [font.file]))('ships %s', (file) => {
    expect(existsSync(file)).toBe(true);
  });
});
