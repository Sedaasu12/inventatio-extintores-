import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  assertValidPassword,
  validatePassword,
} from './password-policy';

describe('password policy (D-06b / BR-179A / BR-179B)', () => {
  it('rechaza contraseñas de 11 caracteres (T-AUT-15)', () => {
    expect(validatePassword('a'.repeat(11))).toEqual({
      valid: false,
      reason: 'TOO_SHORT',
    });
  });

  it('acepta 12 caracteres sin símbolos (T-AUT-17)', () => {
    expect(validatePassword('claveclave12')).toEqual({ valid: true });
  });

  it('acepta hasta 128 caracteres y rechaza 129', () => {
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH))).toEqual({
      valid: true,
    });
    expect(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toEqual({
      valid: false,
      reason: 'TOO_LONG',
    });
  });

  it('rechaza contraseñas comunes de la lista (T-AUT-16)', () => {
    expect(validatePassword('password1234')).toEqual({
      valid: false,
      reason: 'COMMON',
    });
    expect(validatePassword('  Password1234  ')).toEqual({
      valid: false,
      reason: 'COMMON',
    });
  });

  it('expone el mínimo y máximo aprobados', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });

  it('assertValidPassword lanza un error 422 con código estable', () => {
    try {
      assertValidPassword('corta');
      throw new Error('Debió rechazar la contraseña.');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(422);
      expect(apiError.code).toBe(ErrorCodes.PASSWORD_POLICY_VIOLATION);
    }
  });
});
