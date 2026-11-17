import { hash } from 'bcryptjs';

/** Coste mínimo aprobado para bcrypt (D-06b / BR-172). */
export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}
