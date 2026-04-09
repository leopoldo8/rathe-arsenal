import { TokenGeneratorService } from '../token-generator.service';

describe('TokenGeneratorService', () => {
  let service: TokenGeneratorService;

  beforeEach(() => {
    service = new TokenGeneratorService();
  });

  it('generates a 64-character hex raw token (happy path)', () => {
    const token = service.generateRawToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generated tokens are unique across calls', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => service.generateRawToken()));
    expect(tokens.size).toBe(1000);
  });

  it('hashToken produces a 64-character hex sha256', () => {
    const hash = service.hashToken('any string');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // sha256 is deterministic
    expect(service.hashToken('any string')).toBe(hash);
  });

  it('compareToken returns true for the matching raw → stored hash pair (happy path)', () => {
    const raw = service.generateRawToken();
    const stored = service.hashToken(raw);
    expect(service.compareToken(raw, stored)).toBe(true);
  });

  it('compareToken returns false for a mismatch', () => {
    const raw = service.generateRawToken();
    const stored = service.hashToken(service.generateRawToken());
    expect(service.compareToken(raw, stored)).toBe(false);
  });

  it('compareToken returns false for wrong-length stored hash (no throw)', () => {
    const raw = service.generateRawToken();
    expect(service.compareToken(raw, 'short')).toBe(false);
    expect(service.compareToken(raw, '')).toBe(false);
  });

  it('compareToken returns false for non-string inputs (defensive)', () => {
    expect(service.compareToken(undefined as unknown as string, 'a'.repeat(64))).toBe(false);
    expect(service.compareToken('raw', null as unknown as string)).toBe(false);
  });

  it('compareToken handles non-hex stored hash gracefully', () => {
    const raw = service.generateRawToken();
    // 64 chars but not valid hex — Buffer.from('hex') silently produces a shorter buffer
    const malformed = 'z'.repeat(64);
    expect(service.compareToken(raw, malformed)).toBe(false);
  });
});
