import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ChangePasswordPayload } from '../../../core/auth/auth.models';
import { ChangePasswordPage } from './change-password-page';

class AuthStub {
  readonly mustChangePassword = signal(false);
  changePassword = vi.fn<(payload: ChangePasswordPayload) => Observable<void>>(
    () => of(undefined),
  );
}

function setup(forced = false): {
  fixture: ComponentFixture<ChangePasswordPage>;
  auth: AuthStub;
} {
  const auth = new AuthStub();
  auth.mustChangePassword.set(forced);

  TestBed.configureTestingModule({
    imports: [ChangePasswordPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
    ],
  });

  const fixture = TestBed.createComponent(ChangePasswordPage);
  fixture.detectChanges();

  return { fixture, auth };
}

describe('ChangePasswordPage', () => {
  it('avisa del cambio obligatorio cuando corresponde', () => {
    const { fixture } = setup(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Debes cambiar la contraseña');
  });

  it('no envía nada si las contraseñas no coinciden', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance;
    page.form.setValue({
      currentPassword: 'temporal-1234',
      newPassword: 'nueva-clave-1234',
      confirmPassword: 'otra-clave-1234',
    });

    page.submit();
    fixture.detectChanges();

    expect(auth.changePassword).not.toHaveBeenCalled();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Las contraseñas no coinciden.');
  });

  it('exige el mínimo de 12 caracteres', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance;
    page.form.setValue({
      currentPassword: 'temporal-1234',
      newPassword: 'corta',
      confirmPassword: 'corta',
    });

    page.submit();
    fixture.detectChanges();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(page.form.controls.newPassword.errors?.['minlength']).toBeTruthy();
  });

  it('rechaza reutilizar la contraseña actual', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance;
    page.form.setValue({
      currentPassword: 'misma-clave-1234',
      newPassword: 'misma-clave-1234',
      confirmPassword: 'misma-clave-1234',
    });

    page.submit();

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(page.form.hasError('sameAsCurrent')).toBe(true);
  });

  it('cambia la contraseña y muestra el resultado', () => {
    const { fixture, auth } = setup();
    const page = fixture.componentInstance;
    page.form.setValue({
      currentPassword: 'temporal-1234',
      newPassword: 'nueva-clave-1234',
      confirmPassword: 'nueva-clave-1234',
    });

    page.submit();
    fixture.detectChanges();

    expect(auth.changePassword).toHaveBeenCalledWith({
      currentPassword: 'temporal-1234',
      newPassword: 'nueva-clave-1234',
    });
    expect(page.saved()).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Contraseña actualizada.');
  });
});
