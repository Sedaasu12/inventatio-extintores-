export interface AuthIdentity {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  mustChangePassword: boolean;
}

export interface AuthProvider {
  /**
   * Valida las credenciales y devuelve la identidad, o `null` si no son
   * válidas. Nunca revela si el correo existe.
   */
  validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthIdentity | null>;
}

export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');
