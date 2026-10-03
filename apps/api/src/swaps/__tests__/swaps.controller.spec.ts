import { HttpStatus } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { SwapsController } from '../swaps.controller';
import { ISwapMutationResult, SwapsService } from '../swaps.service';

const USER = { userId: 'user-1' } as ICurrentUser;
const SWAP_ID = '7b3f6a52-3d0e-4d4f-9a59-1b2f7c1d9e10';
const RESULT = { deckId: 42, swap: {}, rows: [] } as unknown as ISwapMutationResult;

describe('SwapsController', () => {
  let controller: SwapsController;
  let swapsService: jest.Mocked<SwapsService>;

  beforeEach(async () => {
    swapsService = createMock<SwapsService>();
    swapsService.mutate.mockResolvedValue(RESULT);
    swapsService.list.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SwapsController],
      providers: [{ provide: SwapsService, useValue: swapsService }],
    }).compile();

    controller = module.get(SwapsController);
  });

  it('defaults the list state to pending', async () => {
    await controller.list({}, USER);

    expect(swapsService.list).toHaveBeenCalledWith('user-1', 'pending');
  });

  it('passes an explicit list state through', async () => {
    await controller.list({ state: 'all' }, USER);

    expect(swapsService.list).toHaveBeenCalledWith('user-1', 'all');
  });

  it.each([
    ['approve', () => controller.approve(SWAP_ID, USER), { kind: 'approve' }],
    ['revert', () => controller.revert(SWAP_ID, USER), { kind: 'revert' }],
    ['restore', () => controller.restore(SWAP_ID, USER), { kind: 'restore' }],
    [
      'reject',
      () => controller.reject(SWAP_ID, { reason: 'dont_own', note: 'sold' }, USER),
      { kind: 'reject', reason: 'dont_own', note: 'sold' },
    ],
    [
      'outcome',
      () => controller.outcome(SWAP_ID, { outcome: 'did_not_work' }, USER),
      { kind: 'outcome', outcome: 'did_not_work' },
    ],
  ])('maps %s to the matching action for the current user', async (_name, call, action) => {
    const result = await call();

    expect(swapsService.mutate).toHaveBeenCalledWith('user-1', SWAP_ID, action);
    expect(result).toBe(RESULT);
  });

  it.each(['approve', 'reject', 'revert', 'restore', 'outcome'] as const)(
    'answers %s with 200 instead of the POST default 201',
    (method) => {
      const handler = SwapsController.prototype[method];

      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(HttpStatus.OK);
    },
  );
});
