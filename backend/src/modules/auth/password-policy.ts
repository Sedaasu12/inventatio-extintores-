import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { COMMON_PASSWORDS } from './common-passwords';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordValidation =
  | { valid: true }
  | { valid: false; reason: 'TOO_SHORT' | 'TOO_LONG' | 'COMMON' };

/**
 * Política D-06b: 12–128 caracteres, sin clases obligatorias, sin caducidad.
 * Se rechazan contraseñas comunes de la lista local versionada.
 */
export function validatePassword(password: string): PasswordValidation {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, reason: 'TOO_SHORT' };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { valid: false, reason: 'TOO_LONG' };
  }
  if (COMMON_PASSWORDS.has(password.trim().toLowerCase())) {
    return { valid: false, reason: 'COMMON' };
  }
  return { valid: true };
}

export function assertValidPassword(password: string): void {
  const result = validatePassword(password);
  if (result.valid) {
    return;
  }

  const messages: Record<'TOO_SHORT' | 'TOO_LONG' | 'COMMON', string> = {
    TOO_SHORT: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    TOO_LONG: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    COMMON: 'La contraseña es demasiado común; elige otra.',
  };

  throw ApiError.unprocessable(
    ErrorCodes.PASSWORD_POLICY_VIOLATION,
    messages[result.reason],
    [{ field: 'password', reason: result.reason }],
  );
}
