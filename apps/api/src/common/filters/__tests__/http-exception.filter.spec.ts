import { ArgumentsHost, BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';

const captureExceptionMock = jest.fn();

jest.mock('@sentry/node', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import { HttpExceptionFilter } from '../http-exception.filter';

function makeHost(jsonMock: jest.Mock) {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jsonMock,
  };
  const request = { url: '/auth/sign-in', method: 'POST' };
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    // suppress logger noise in unit tests
    jest.spyOn((filter as unknown as { logger: { error: jest.Mock } }).logger, 'error').mockImplementation();
  });

  // Done-when: filter envelope includes code when exception response carries one
  it('includes code in the envelope when the exception response has a code field', () => {
    const jsonMock = jest.fn();
    const host = makeHost(jsonMock);
    const exception = new UnauthorizedException({
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
    filter.catch(exception, host);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.code).toBe('INVALID_CREDENTIALS');
    expect(body.error).toBe('Invalid email or password');
    expect(body.statusCode).toBe(401);
    expect(body.success).toBe(false);
  });

  // Done-when: filter envelope omits code when exception response has no code field (backward compatible)
  it('omits code from the envelope when the exception response has no code field', () => {
    const jsonMock = jest.fn();
    const host = makeHost(jsonMock);
    const exception = new BadRequestException('Plain error message');
    filter.catch(exception, host);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.code).toBeUndefined();
    expect(body.error).toBe('Plain error message');
    expect(body.statusCode).toBe(400);
  });

  // Done-when: error string still present, status mapping unchanged
  it('returns status 500 and no code for non-HTTP exceptions', () => {
    const jsonMock = jest.fn();
    const host = makeHost(jsonMock);
    filter.catch(new Error('Something went wrong'), host);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.statusCode).toBe(500);
    expect(body.code).toBeUndefined();
    expect(body.success).toBe(false);
  });

  // Done-when: error string present for string payload (existing behavior)
  it('uses the string payload as error for string-response exceptions', () => {
    const jsonMock = jest.fn();
    const host = makeHost(jsonMock);
    const exception = new HttpException('Simple string error', 422);
    filter.catch(exception, host);
    const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.error).toBe('Simple string error');
    expect(body.statusCode).toBe(422);
    expect(body.code).toBeUndefined();
  });

  describe('Sentry capture (OBS-04)', () => {
    beforeEach(() => {
      captureExceptionMock.mockClear();
    });

    it('captures a non-HttpException to Sentry and preserves the response envelope', () => {
      const jsonMock = jest.fn();
      const host = makeHost(jsonMock);
      const exception = new Error('Something went wrong');

      filter.catch(exception, host);

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      expect(captureExceptionMock).toHaveBeenCalledWith(exception);

      const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(typeof body.timestamp).toBe('string');
    });

    it('captures an HttpException with status >= 500 to Sentry and preserves the response envelope', () => {
      const jsonMock = jest.fn();
      const host = makeHost(jsonMock);
      const exception = new HttpException('Server exploded', 500);

      filter.catch(exception, host);

      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      expect(captureExceptionMock).toHaveBeenCalledWith(exception);

      const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(500);
      expect(body.error).toBe('Server exploded');
      expect(typeof body.timestamp).toBe('string');
    });

    it('does NOT capture a 4xx HttpException to Sentry, and still preserves the response envelope', () => {
      const jsonMock = jest.fn();
      const host = makeHost(jsonMock);
      const exception = new HttpException('Bad input', 400);

      filter.catch(exception, host);

      expect(captureExceptionMock).not.toHaveBeenCalled();

      const body = jsonMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad input');
      expect(typeof body.timestamp).toBe('string');
    });
  });
});
