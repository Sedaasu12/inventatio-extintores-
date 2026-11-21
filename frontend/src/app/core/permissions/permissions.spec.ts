import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../auth/auth.models';
import { HasPermissionDirective } from './has-permission.directive';
import { PermissionService } from './permission.service';

const USER: AuthUser = {
  id: 'user-1',
  email: 'almacen@site.local',
  fullName: 'Encargado de almacén',
  roles: ['ALMACEN'],
  permissions: ['extinguishers.read', 'extinguishers.create'],
  mustChangePassword: false,
};

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `
    <p *appHasPermission="'extinguishers.create'">alta</p>
    <p *appHasPermission="'alerts.settings'">ajustes</p>
    <p *appHasPermission="['extinguishers.read', 'alerts.settings']; mode: 'all'">
      ambas
    </p>
  `,
})
class HostComponent {}

describe('permisos', () => {
  let userSignal: WritableSignal<AuthUser | null>;

  beforeEach(() => {
    userSignal = signal<AuthUser | null>(USER);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: AuthService, useValue: { user: userSignal } },
      ],
    });
  });

  it('consulta permisos individuales, cualquiera y todos', () => {
    const permissions = TestBed.inject(PermissionService);

    expect(permissions.has('extinguishers.read')).toBe(true);
    expect(permissions.has('alerts.settings')).toBe(false);
    expect(
      permissions.hasAny(['alerts.settings', 'extinguishers.create']),
    ).toBe(true);
    expect(
      permissions.hasAll(['extinguishers.read', 'alerts.settings']),
    ).toBe(false);
    expect(
      permissions.isAllowed(['extinguishers.read', 'extinguishers.create'], 'all'),
    ).toBe(true);
  });

  it('renderiza solo las acciones permitidas', () => {
    const fixture: ComponentFixture<HostComponent> =
      TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('alta');
    expect(text).not.toContain('ajustes');
    expect(text).not.toContain('ambas');
  });

  it('reacciona a un cambio de permisos del usuario', () => {
    const fixture: ComponentFixture<HostComponent> =
      TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    userSignal.set({ ...USER, permissions: ['extinguishers.read'] });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('alta');
  });
});
