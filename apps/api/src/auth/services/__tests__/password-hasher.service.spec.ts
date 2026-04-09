import { PasswordHasherService } from '../password-hasher.service';

describe('PasswordHasherService', () => {
  let service: PasswordHasherService;

  beforeEach(() => {
    service = new PasswordHasherService();
  });

  it('produces a 60-character bcrypt hash and verifies it (happy path)', async () => {
    const password = 'correcthorsebattery';
    const hash = await service.hash(password);
    expect(hash).toHaveLength(60);
    expect(hash.startsWith('$2')).toBe(true);
    await expect(service.verify(password, hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct');
    await expect(service.verify('wrong', hash)).resolves.toBe(false);
  });

  it('hashes are non-deterministic (salt is randomized)', async () => {
    const password = 'correcthorsebattery';
    const a = await service.hash(password);
    const b = await service.hash(password);
    expect(a).not.toBe(b);
    // Both should still verify against the same plain
    await expect(service.verify(password, a)).resolves.toBe(true);
    await expect(service.verify(password, b)).resolves.toBe(true);
  });

  it('handles empty password (DTO is responsible for length validation, not the hasher)', async () => {
    const hash = await service.hash('');
    await expect(service.verify('', hash)).resolves.toBe(true);
    await expect(service.verify('x', hash)).resolves.toBe(false);
  });
});
