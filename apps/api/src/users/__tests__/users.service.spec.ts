import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { Repository, UpdateResult } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { UsersService } from '../users.service';

function buildService(repoOverrides: Partial<{
  findOne: jest.Mock;
  update: jest.Mock;
}> = {}) {
  const repo = createMock<Repository<UserEntity>>();
  repo.findOne = repoOverrides.findOne ?? jest.fn().mockResolvedValue(null);
  repo.update = repoOverrides.update ?? jest.fn().mockResolvedValue({ affected: 1, raw: [] } as UpdateResult);

  const service = new UsersService(repo as unknown as Repository<UserEntity>);
  return { service, repo };
}

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    emailVerifiedAt: new Date(),
    verificationTokenHash: null,
    verificationTokenExpiresAt: null,
    passwordResetTokenHash: null,
    passwordResetTokenExpiresAt: null,
    deletedAt: null,
    preferences: { theme: 'dark' },
    createdAt: new Date(),
    ...overrides,
  } as UserEntity;
}

describe('UsersService.getSettings', () => {
  it('returns dark theme for a fresh user with default preferences', async () => {
    const user = makeUser();
    const { service, repo } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getSettings('user-1');
    expect(result).toEqual({ theme: 'dark' });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('returns light theme when user has preferences.theme = light', async () => {
    const user = makeUser({ preferences: { theme: 'light' } });
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getSettings('user-1');
    expect(result).toEqual({ theme: 'light' });
  });

  it('returns dark theme as fallback when preferences is NULL (defensive)', async () => {
    const user = makeUser({ preferences: null });
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(user) });
    const result = await service.getSettings('user-1');
    expect(result).toEqual({ theme: 'dark' });
  });

  it('throws NotFoundException when user row is missing', async () => {
    const { service } = buildService({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(service.getSettings('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.patchSettings', () => {
  it('issues an atomic UPDATE targeting only preferences and returns new value', async () => {
    const updateMock = jest.fn().mockResolvedValue({ affected: 1, raw: [] } as UpdateResult);
    const { service, repo } = buildService({ update: updateMock });

    const result = await service.patchSettings('user-1', 'light');

    expect(result).toEqual({ theme: 'light' });
    expect(updateMock).toHaveBeenCalledWith({ id: 'user-1' }, { preferences: { theme: 'light' } });
    // Targeted UPDATE — we do NOT pre-fetch the row; this eliminates the
    // read-modify-write race with concurrent soft-delete writes to other columns.
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('persists theme=dark correctly', async () => {
    const updateMock = jest.fn().mockResolvedValue({ affected: 1, raw: [] } as UpdateResult);
    const { service } = buildService({ update: updateMock });
    const result = await service.patchSettings('user-1', 'dark');
    expect(result).toEqual({ theme: 'dark' });
    expect(updateMock).toHaveBeenCalledWith({ id: 'user-1' }, { preferences: { theme: 'dark' } });
  });

  it('throws NotFoundException when no row was updated (vanished user)', async () => {
    const updateMock = jest.fn().mockResolvedValue({ affected: 0, raw: [] } as UpdateResult);
    const { service } = buildService({ update: updateMock });
    await expect(service.patchSettings('ghost', 'light')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('writes only the closed-schema { theme } key — no unknown keys persisted', async () => {
    const updateMock = jest.fn().mockResolvedValue({ affected: 1, raw: [] } as UpdateResult);
    const { service } = buildService({ update: updateMock });
    await service.patchSettings('user-1', 'light');
    const [, partial] = updateMock.mock.calls[0] as [unknown, { preferences: Record<string, unknown> }];
    expect(Object.keys(partial.preferences)).toEqual(['theme']);
  });
});

describe('UsersService profile updates', () => {
  it('stores the display name', async () => {
    const { service, repo } = buildService();

    const result = await service.updateDisplayName('user-1', 'Rodrigo');

    expect(result).toEqual({ displayName: 'Rodrigo' });
    expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { displayName: 'Rodrigo' });
  });

  it('stores the normalized WhatsApp number', async () => {
    const { service, repo } = buildService();

    const result = await service.updateContact('user-1', '(51) 99999-0000');

    expect(result).toEqual({ whatsappNumber: '5551999990000' });
    expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { whatsappNumber: '5551999990000' });
  });

  it('clears the number on null', async () => {
    const { service, repo } = buildService();

    const result = await service.updateContact('user-1', null);

    expect(result).toEqual({ whatsappNumber: null });
    expect(repo.update).toHaveBeenCalledWith({ id: 'user-1' }, { whatsappNumber: null });
  });

  it('rejects a number that cannot be a phone number without writing', async () => {
    const { service, repo } = buildService();

    await expect(service.updateContact('user-1', '123')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws NotFound when the user row is gone', async () => {
    const { service } = buildService({ update: jest.fn().mockResolvedValue({ affected: 0, raw: [] }) });

    await expect(service.updateDisplayName('user-1', 'Rodrigo')).rejects.toBeInstanceOf(NotFoundException);
  });
});
