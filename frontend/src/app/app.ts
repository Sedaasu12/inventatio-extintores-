import { Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

/**
 * Raíz de la aplicación.
 *
 * Cuando una sesión activa se pierde (el refresh falla), se vuelve al login
 * conservando la ruta solicitada para retomarla después. La navegación se
 * hace aquí, una sola vez, y no en cada respuesta 401: así se evitan bucles
 * y entradas repetidas en el historial.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.auth.sessionExpired()) {
        return;
      }
      const returnUrl = this.router.url;
      this.auth.acknowledgeSessionExpiry();
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl, expired: true },
      });
    });
  }
}
