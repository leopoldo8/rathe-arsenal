import { createMock } from '@golevelup/ts-jest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
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
});
