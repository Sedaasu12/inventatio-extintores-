import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './core/auth/auth.service';

class AuthStub {
  readonly sessionExpired = signal(false);
  readonly acknowledgeSessionExpiry = vi.fn(() => {
    this.sessionExpired.set(false);
  });
}

describe('App', () => {
  let auth: AuthStub;

  beforeEach(() => {
    auth = new AuthStub();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  it('muestra el enrutador principal', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('router-outlet'),
    ).not.toBeNull();
  });

  it('vuelve al login con la ruta actual cuando la sesión caduca', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    TestBed.createComponent(App);
    auth.sessionExpired.set(true);
    TestBed.tick();

    expect(auth.acknowledgeSessionExpiry).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: router.url, expired: true },
    });
  });

  it('no navega si no hay caducidad pendiente', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    TestBed.createComponent(App);
    TestBed.tick();

    expect(navigate).not.toHaveBeenCalled();
  });
});
