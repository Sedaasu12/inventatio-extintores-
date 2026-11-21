import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, firstValueFrom, map, of, shareReplay, tap, throwError } from 'rxjs';
import { ApiClient } from '../api/api-client';
import {
  AuthSession,
  AuthStatus,
  AuthUser,
  ChangePasswordPayload,
  LoginCredentials,
} from './auth.models';

/** Margen para renovar antes de que caduque el access token. */
const REFRESH_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

/**
 * Sesión del usuario.
 *
 * El access token vive **solo en memoria** (D-06 / T-SEC-10); el refresh token
 * viaja en una cookie `HttpOnly` que el JavaScript no puede leer. La renovación
 * es *single-flight*: varias respuestas 401 simultáneas comparten una única
 * llamada a `/auth/refresh`, lo que evita bucles y familias revocadas.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly token = signal<string | null>(null);
  private readonly currentUser = signal<AuthUser | null>(null);
  private readonly currentStatus = signal<AuthStatus>('unknown');
  private readonly expiredSession = signal(false);

  private refreshInFlight: Observable<AuthSession> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly status = this.currentStatus.asReadonly();
  /** `true` cuando una sesión activa terminó porque el refresh falló. */
  readonly sessionExpired = this.expiredSession.asReadonly();
  readonly isAuthenticated = computed(
    () => this.currentStatus() === 'authenticated',
  );
  readonly mustChangePassword = computed(
    () => this.currentUser()?.mustChangePassword === true,
  );
  readonly displayName = computed(() => this.currentUser()?.fullName ?? '');

  constructor() {
    this.destroyRef.onDestroy(() => this.clearRefreshTimer());
  }

  /** Token para el interceptor; nunca se expone en la plantilla. */
  accessToken(): string | null {
    return this.token();
  }

  login(credentials: LoginCredentials): Observable<AuthUser> {
    this.currentStatus.set('authenticating');
    return this.api
      .post<AuthSession>('/auth/login', credentials, { withCredentials: true })
      .pipe(
        tap((session) => this.applySession(session)),
        map((session) => session.user),
        catchError((error: unknown) => {
          this.currentStatus.set('anonymous');
          return throwError(() => error);
        }),
      );
  }

  /**
   * Restaura la sesión al arrancar usando la cookie de refresh. Si no hay
   * cookie válida la aplicación continúa como anónima, sin bucles.
   */
  async restoreSession(): Promise<void> {
    if (this.currentStatus() === 'authenticated') {
      return;
    }
    try {
      await firstValueFrom(this.refreshSession());
    } catch {
      this.clearSession();
    }
  }

  /** Renovación compartida: una sola petición aunque haya varios 401. */
  refreshSession(): Observable<AuthSession> {
    if (this.refreshInFlight !== null) {
      return this.refreshInFlight;
    }
    this.refreshInFlight = this.api
      .post<AuthSession>('/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap((session) => this.applySession(session)),
        catchError((error: unknown) => {
          // Solo es una caducidad si había sesión: el arranque anónimo no
          // debe mostrar el aviso de "sesión expirada".
          if (this.token() !== null || this.currentStatus() === 'authenticated') {
            this.expiredSession.set(true);
          }
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  logout(): Observable<void> {
    return this.api
      .post<void>('/auth/logout', {}, { withCredentials: true })
      .pipe(
        catchError(() => of(undefined)),
        finalize(() => this.clearSession()),
      );
  }

  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.api
      .post<void>('/auth/change-password', payload)
      .pipe(tap(() => this.markPasswordChanged()));
  }

  clearSession(): void {
    this.clearRefreshTimer();
    this.token.set(null);
    this.currentUser.set(null);
    this.currentStatus.set('anonymous');
  }

  /** Marca el aviso de caducidad como ya mostrado por la interfaz. */
  acknowledgeSessionExpiry(): void {
    this.expiredSession.set(false);
  }

  private applySession(session: AuthSession): void {
    this.token.set(session.accessToken);
    this.currentUser.set(session.user);
    this.currentStatus.set('authenticated');
    this.expiredSession.set(false);
    this.scheduleRefresh(session.expiresIn);
  }

  private markPasswordChanged(): void {
    const user = this.currentUser();
    if (user !== null) {
      this.currentUser.set({ ...user, mustChangePassword: false });
    }
  }

  private scheduleRefresh(expiresInSeconds: number): void {
    this.clearRefreshTimer();
    const delay = Math.max(
      expiresInSeconds * 1000 - REFRESH_MARGIN_MS,
      MIN_REFRESH_DELAY_MS,
    );
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      if (this.token() === null) {
        return;
      }
      this.refreshSession().subscribe({ error: () => undefined });
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
