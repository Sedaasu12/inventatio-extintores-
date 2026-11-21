import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiClientError } from './api-error';

function response(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: body,
    headers: new HttpHeaders(headers),
  });
}

describe('ApiClientError', () => {
  it('conserva el código estable, el mensaje y la referencia del servidor', () => {
    const error = ApiClientError.fromResponse(
      response(
        422,
        {
          error: {
            code: 'CONDITION_NOT_ASSIGNABLE',
            message: 'No puedes asignar esa condición.',
            details: { condition: 'NO_OPERATIVO' },
            requestId: 'req-123',
          },
        },
        { 'Retry-After': '15' },
      ),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('CONDITION_NOT_ASSIGNABLE');
    expect(error.serverMessage).toBe('No puedes asignar esa condición.');
    expect(error.details).toEqual({ condition: 'NO_OPERATIVO' });
    expect(error.requestId).toBe('req-123');
    expect(error.retryAfterSeconds).toBe(15);
  });

  it('usa un código por estado cuando el cuerpo no es JSON', () => {
    const error = ApiClientError.fromResponse(
      response(503, '<html>caído</html>'),
    );

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(503);
  });

  it('marca los fallos de red sin mensaje técnico del navegador', () => {
    const error = ApiClientError.fromUnknown(new TypeError('Failed to fetch'));

    expect(error.status).toBe(0);
    expect(error.code).toBe('UNKNOWN_ERROR');
  });

  it('lee la referencia desde la cabecera cuando el cuerpo no la trae', () => {
    const error = ApiClientError.fromResponse(
      response(404, { error: { code: 'NOT_FOUND', message: 'No existe' } }, {
        'X-Request-Id': 'req-header',
      }),
    );

    expect(error.requestId).toBe('req-header');
  });
});
