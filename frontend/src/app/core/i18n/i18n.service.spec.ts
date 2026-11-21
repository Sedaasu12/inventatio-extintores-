import { TestBed } from '@angular/core/testing';
import { ApiClientError } from '../api/api-error';
import { ES_PE } from './es-PE';
import { I18nService } from './i18n.service';

describe('I18nService (D-30)', () => {
  let i18n: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    i18n = TestBed.inject(I18nService);
  });

  it('mantiene un diccionario completo, sin valores vacíos ni claves duplicadas', () => {
    const entries = Object.entries(ES_PE);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(key.trim()).not.toBe('');
      expect(value.trim()).not.toBe('');
    }
    expect(new Set(entries.map(([key]) => key)).size).toBe(entries.length);
  });

  it('resuelve claves con parámetros', () => {
    expect(
      i18n.translate('errors.requestId', { requestId: 'req-9' }),
    ).toBe('Referencia del error: req-9');
  });

  it('devuelve la clave si la traducción no existe (sin romper la vista)', () => {
    expect(i18n.translate('clave.inexistente' as never)).toBe(
      'clave.inexistente',
    );
  });

  it('traduce los códigos conocidos sin alterar el código estable', () => {
    const error = new ApiClientError(
      0,
      'NETWORK_ERROR',
      'Http failure response for /api',
    );

    expect(i18n.translateError(error)).toBe(
      'No se pudo conectar con el servidor. Revisa tu conexión.',
    );
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('muestra el mensaje en español del servidor para códigos no mapeados', () => {
    const error = new ApiClientError(
      422,
      'ORIGIN_MISMATCH',
      'El origen no coincide con la ubicación actual.',
    );

    expect(i18n.translateError(error)).toBe(
      'El origen no coincide con la ubicación actual.',
    );
  });

  it('no usa el mensaje técnico del navegador cuando no hay alternativa', () => {
    const error = new ApiClientError(
      0,
      'UNKNOWN_ERROR',
      'Http failure response for /api: 0 Unknown Error',
    );

    expect(i18n.translateError(error)).toBe('Ocurrió un error inesperado.');
  });
});
