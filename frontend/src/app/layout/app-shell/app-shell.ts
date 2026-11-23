import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { TranslationKey } from '../../core/i18n/es-PE';
import { TPipe } from '../../core/i18n/t.pipe';
import { PermissionService } from '../../core/permissions/permission.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog';

interface NavItem {
  labelKey: TranslationKey;
  path: string;
  permission: string;
  exact: boolean;
}

/**
 * Solo se listan secciones implementadas. Las fases 9 y 10 añaden el resto
 * con su permiso correspondiente.
 */
const NAV_ITEMS: readonly NavItem[] = [
  {
    labelKey: 'nav.dashboard',
    path: '/app/inicio',
    permission: 'dashboard.read',
    exact: true,
  },
  {
    labelKey: 'nav.inventory',
    path: '/app/extintores',
    permission: 'extinguishers.read',
    exact: false,
  },
];

@Component({
  selector: 'app-app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TPipe,
    ConfirmDialogComponent,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly authService = inject(AuthService);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly menuOpen = signal(false);
  readonly logoutOpen = signal(false);
  readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => this.permissions.has(item.permission)),
  );

  private readonly mainContent =
    viewChild.required<ElementRef<HTMLElement>>('mainContent');

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.menuOpen.set(false);
        this.mainContent().nativeElement.focus();
      });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  focusMain(event: Event): void {
    event.preventDefault();
    this.mainContent().nativeElement.focus();
  }

  logout(): void {
    this.logoutOpen.set(false);
    this.authService.logout().subscribe({
      complete: () => {
        void this.router.navigateByUrl('/login');
      },
    });
  }
}
