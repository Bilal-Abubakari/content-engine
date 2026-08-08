import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

/** Build a mock ArgumentsHost capturing the response status/json. */
function mockHost(method = 'GET', url = '/api/test') {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method, url }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  describe('known HttpExceptions', () => {
    it.each<{ label: string; exception: HttpException; status: number }>([
      {
        label: 'BadRequest',
        exception: new BadRequestException('bad input'),
        status: HttpStatus.BAD_REQUEST,
      },
      {
        label: 'NotFound',
        exception: new NotFoundException('nope'),
        status: HttpStatus.NOT_FOUND,
      },
      {
        label: 'TooManyRequests',
        exception: new HttpException('slow down', HttpStatus.TOO_MANY_REQUESTS),
        status: HttpStatus.TOO_MANY_REQUESTS,
      },
    ])(
      'preserves the $label status and message',
      ({ exception, status: expected }) => {
        const { host, status, json } = mockHost();
        filter.catch(exception, host);
        expect(status).toHaveBeenCalledWith(expected);
        expect(json).toHaveBeenCalledWith(
          expect.objectContaining({ statusCode: expected }),
        );
      },
    );
  });

  it('maps unknown errors to a generic 500 without leaking details', () => {
    const { host, status, json } = mockHost();
    filter.catch(new Error('secret db connection string leaked'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'InternalServerError',
      }),
    );
    const body = json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('secret db connection string');
  });

  it('includes the request path and a timestamp', () => {
    const { host, json } = mockHost('POST', '/api/billing/checkout');
    filter.catch(new BadRequestException('x'), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/billing/checkout',
        timestamp: expect.any(String),
      }),
    );
  });
});
