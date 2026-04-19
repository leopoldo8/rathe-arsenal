import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { createMock } from '@golevelup/ts-jest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { PatchThemeDto } from '../dtos/user-settings.dto';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';

function buildController(serviceOverrides: Partial<{
  getSettings: jest.Mock;
  patchSettings: jest.Mock;
}> = {}) {
  const service = createMock<UsersService>();
  service.getSettings = serviceOverrides.getSettings ?? jest.fn().mockResolvedValue({ theme: 'dark' });
  service.patchSettings = serviceOverrides.patchSettings ?? jest.fn().mockResolvedValue({ theme: 'dark' });

  const controller = new UsersController(service as unknown as UsersService);
  return { controller, service };
}

const MOCK_USER: ICurrentUser = { userId: 'user-1', email: 'test@example.com' };

describe('UsersController.getSettings', () => {
  it('delegates to service.getSettings with the authenticated user id', async () => {
    // Arrange
    const getSettingsMock = jest.fn().mockResolvedValue({ theme: 'light' });
    const { controller } = buildController({ getSettings: getSettingsMock });

    // Act
    const result = await controller.getSettings(MOCK_USER);

    // Assert
    expect(result).toEqual({ theme: 'light' });
    expect(getSettingsMock).toHaveBeenCalledWith('user-1');
  });

  it('returns dark as default theme', async () => {
    // Arrange
    const { controller } = buildController({
      getSettings: jest.fn().mockResolvedValue({ theme: 'dark' }),
    });

    // Act
    const result = await controller.getSettings(MOCK_USER);

    // Assert
    expect(result).toEqual({ theme: 'dark' });
  });
});

describe('UsersController.patchSettings', () => {
  it('delegates to service.patchSettings with user id and theme value', async () => {
    // Arrange
    const patchMock = jest.fn().mockResolvedValue({ theme: 'light' });
    const { controller } = buildController({ patchSettings: patchMock });

    // Act
    const result = await controller.patchSettings(MOCK_USER, { theme: 'light' });

    // Assert
    expect(result).toEqual({ theme: 'light' });
    expect(patchMock).toHaveBeenCalledWith('user-1', 'light');
  });

  it('delegates theme=dark correctly', async () => {
    // Arrange
    const patchMock = jest.fn().mockResolvedValue({ theme: 'dark' });
    const { controller } = buildController({ patchSettings: patchMock });

    // Act
    const result = await controller.patchSettings(MOCK_USER, { theme: 'dark' });

    // Assert
    expect(result).toEqual({ theme: 'dark' });
    expect(patchMock).toHaveBeenCalledWith('user-1', 'dark');
  });

  it('propagates NotFoundException from the service (user row vanished)', async () => {
    const { controller } = buildController({
      patchSettings: jest.fn().mockRejectedValue(new NotFoundException('User not found')),
    });
    await expect(controller.patchSettings(MOCK_USER, { theme: 'light' }))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersController.getSettings — error propagation', () => {
  it('propagates NotFoundException from the service', async () => {
    const { controller } = buildController({
      getSettings: jest.fn().mockRejectedValue(new NotFoundException('User not found')),
    });
    await expect(controller.getSettings(MOCK_USER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PatchThemeDto validation', () => {
  // The controller binds @Body() PatchThemeDto — the ValidationPipe rejects
  // invalid payloads at the 400 boundary. These tests exercise the DTO rules
  // directly, since the pipe is an app-level concern not present in the
  // controller unit test harness.

  it('accepts theme="dark"', async () => {
    const dto = plainToInstance(PatchThemeDto, { theme: 'dark' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts theme="light"', async () => {
    const dto = plainToInstance(PatchThemeDto, { theme: 'light' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid theme values (e.g. "purple")', async () => {
    const dto = plainToInstance(PatchThemeDto, { theme: 'purple' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.constraints).toHaveProperty('isIn');
  });

  it('rejects theme="modified" (future state not yet supported)', async () => {
    const dto = plainToInstance(PatchThemeDto, { theme: 'modified' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing theme field', async () => {
    const dto = plainToInstance(PatchThemeDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
