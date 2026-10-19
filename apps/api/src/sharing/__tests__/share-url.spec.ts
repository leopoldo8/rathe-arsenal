import { buildDeckShareUrl } from '../share-url';

describe('buildDeckShareUrl', () => {
  it('joins the base and the token without doubling the slash', () => {
    expect(buildDeckShareUrl('https://app.example/', 'tok')).toBe('https://app.example/d/tok');
  });

  it('falls back to the local dev origin', () => {
    expect(buildDeckShareUrl(undefined, 'tok')).toBe('http://localhost:5173/d/tok');
  });
});
