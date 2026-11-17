export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  mustChangePassword: boolean;
}

export interface AuthenticatedRequest {
  user?: AuthenticatedUser;
  requestId?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
  header(name: string): string | undefined;
}
