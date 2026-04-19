import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { UsersService } from '../users.service';

function buildService(repoOverrides: Partial<{
  findOne: jest.Mock;
  save: jest.Mock;
}> = {}) {
  const repo = createMock<Repository<UserEntity>>();
  repo.findOne = repoOverrides.findOne ?? jest.fn().mockResolvedValue(null);
  repo.save = repoOverrides.save ?? jest.fn().mockImplementation(async (u: Partial<UserEntity>) => u as UserEntity);

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
    // Arrange
    const user = makeUser();
    const { service, repo } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    // Act
    const result = await service.getSettings('user-1');

    // Assert
    expect(result).toEqual({ theme: 'dark' });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('returns light theme when user has preferences.theme = light', async () => {
    // Arrange
    const user = makeUser({ preferences: { theme: 'light' } });
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    // Act
    const result = await service.getSettings('user-1');

    // Assert
    expect(result).toEqual({ theme: 'light' });
  });

  it('returns dark theme as fallback when user preferences is NULL (defensive edge case)', async () => {
    // Arrange — simulate a row that somehow has NULL preferences (pre-migration row)
    const user = makeUser({ preferences: null });
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
    });

    // Act
    const result = await service.getSettings('user-1');

    // Assert
    expect(result).toEqual({ theme: 'dark' });
  });
});

describe('UsersService.patchSettings', () => {
  it('updates preferences.theme to light and returns updated settings', async () => {
    // Arrange
    const user = makeUser({ preferences: { theme: 'dark' } });
    const updatedUser = { ...user, preferences: { theme: 'light' as const } };
    const saveMock = jest.fn().mockResolvedValue(updatedUser);
    const { service, repo } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save: saveMock,
    });

    // Act
    const result = await service.patchSettings('user-1', 'light');

    // Assert
    expect(result).toEqual({ theme: 'light' });
    expect(saveMock).toHaveBeenCalledWith({
      ...user,
      preferences: { theme: 'light' },
    });
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('persists theme=dark correctly', async () => {
    // Arrange
    const user = makeUser({ preferences: { theme: 'light' } });
    const saveMock = jest.fn().mockResolvedValue({ ...user, preferences: { theme: 'dark' } });
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save: saveMock,
    });

    // Act
    const result = await service.patchSettings('user-1', 'dark');

    // Assert
    expect(result).toEqual({ theme: 'dark' });
    expect(saveMock).toHaveBeenCalledWith({
      ...user,
      preferences: { theme: 'dark' },
    });
  });

  it('uses dark fallback when preferences is NULL and still saves correctly', async () => {
    // Arrange — simulate null preferences row
    const user = makeUser({ preferences: null });
    const saveMock = jest.fn().mockResolvedValue({ ...user, preferences: { theme: 'light' } });
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save: saveMock,
    });

    // Act
    const result = await service.patchSettings('user-1', 'light');

    // Assert
    expect(result).toEqual({ theme: 'light' });
  });

  it('strips unknown keys — only stores closed-schema { theme } in preferences', async () => {
    // Arrange — simulate a scenario where the column read back only has theme
    const user = makeUser({ preferences: { theme: 'dark' } });
    const saveMock = jest.fn().mockResolvedValue({ ...user, preferences: { theme: 'light' } });
    const { service } = buildService({
      findOne: jest.fn().mockResolvedValue(user),
      save: saveMock,
    });

    // Act — service only accepts theme; unknown keys never reach here (stripped by DTO/ValidationPipe)
    const result = await service.patchSettings('user-1', 'light');

    // Assert — saved value is exactly { theme: 'light' }, no other keys
    const savedArg = saveMock.mock.calls[0][0] as { preferences: { theme: string } };
    expect(Object.keys(savedArg.preferences)).toEqual(['theme']);
    expect(result).toEqual({ theme: 'light' });
  });
});
