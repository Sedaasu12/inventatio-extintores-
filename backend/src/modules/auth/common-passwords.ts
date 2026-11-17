/**
 * Lista local versionada de contraseñas comunes (BR-179B).
 * Se compara en minúsculas y sin distinguir espacios en los extremos.
 * Al ampliar la lista se incrementa `COMMON_PASSWORDS_VERSION`.
 */
export const COMMON_PASSWORDS_VERSION = 1;

export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '123456789012',
  '1234567890123',
  '1234567890',
  'password',
  'password123',
  'password1234',
  'qwertyuiop',
  'qwertyuiop12',
  'abcdefghijkl',
  'administrador',
  'administrador1',
  'contrasena123',
  'contraseña123',
  'iloveyou1234',
  'welcome12345',
  'letmein12345',
  'changeme1234',
  'site12345678',
  'extintores123',
  'seguridad123',
  'bienvenido123',
]);
