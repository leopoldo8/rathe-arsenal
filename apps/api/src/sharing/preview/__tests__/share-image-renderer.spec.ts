import sharp from 'sharp';
import { fanSlots, MAX_JPEG_BYTES } from '../image-layout';
import { renderShareImage, type IShareImageInput } from '../share-image-renderer';

const INPUT: IShareImageInput = {
  kindLabel: 'Deck',
  sharerName: 'Rodrigo H.',
  title: 'Lâminas de Ironsong',
  heroName: 'Dorinthea Ironsong',
  detail: 'Classic Constructed · 60 cartas',
  shareAddress: 'ra.example/d/AbCdEfGhIjKlMnOpQrStUv',
  legalLine: '© Legend Story Studios · Projeto de fã não oficial',
  byLabel: 'por',
};

async function fakeFace(color: string): Promise<Buffer> {
  return sharp({ create: { width: 450, height: 630, channels: 3, background: color } })
    .webp()
    .toBuffer();
}

describe('renderShareImage', () => {
  it('draws a 1200x630 JPEG under the size limit, with placeholders for every missing face', async () => {
    const jpeg = await renderShareImage(INPUT, { faces: [null, null, null, null, null], backdrop: null });
    const meta = await sharp(jpeg).metadata();

    expect(meta).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
    expect(jpeg.length).toBeLessThan(MAX_JPEG_BYTES);
  });

  it('draws the text itself: a different title changes the pixels of the title area', async () => {
    const artwork = { faces: [], backdrop: null };
    const area = { left: 40, top: 500, width: 700, height: 70 };
    const crop = async (title: string): Promise<Buffer> =>
      sharp(await renderShareImage({ ...INPUT, title }, artwork)).extract(area).raw().toBuffer();

    const [first, second, empty] = await Promise.all([crop('Lâminas'), crop('Outro deck'), crop('')]);

    expect(first.equals(second)).toBe(false);
    expect(first.equals(empty)).toBe(false);
  });

  it('survives very long and markup-laden names, keeping the size', async () => {
    const jpeg = await renderShareImage(
      {
        ...INPUT,
        title: `<b>${'Muito longo '.repeat(30)}</b> & "aspas"`,
        sharerName: 'N'.repeat(80),
        heroName: 'H'.repeat(80),
      },
      { faces: [await fakeFace('#336699'), null, await fakeFace('#996633')], backdrop: await fakeFace('#336699') },
    );

    expect(await sharp(jpeg).metadata()).toMatchObject({ width: 1200, height: 630 });
    expect(jpeg.length).toBeLessThan(MAX_JPEG_BYTES);
  });

  it('renders the generic image without a byline or kind label', async () => {
    const jpeg = await renderShareImage(
      { ...INPUT, kindLabel: '', sharerName: '', byLabel: '' },
      { faces: [], backdrop: null },
    );

    expect(await sharp(jpeg).metadata()).toMatchObject({ width: 1200, height: 630 });
  });
});

describe('fanSlots', () => {
  it.each([1, 2, 3, 4, 5])('puts the hero on the slot nearest the center for %i cards', (count) => {
    const slots = fanSlots(count);
    const hero = slots.filter((slot) => slot.isHeroSlot);

    expect(slots).toHaveLength(count);
    expect(hero).toHaveLength(1);
    expect(Math.max(...slots.map((slot) => slot.zIndex))).toBe(hero[0]?.zIndex);
  });

  it('never fans more than five cards', () => {
    expect(fanSlots(9)).toHaveLength(5);
  });
});
