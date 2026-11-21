import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../core/i18n/t.pipe';

/** 403: el usuario está autenticado pero no tiene el permiso de la ruta. */
@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, TPipe],
  template: `
    <section class="error-page" aria-labelledby="forbidden-title">
      <p class="error-page__code" aria-hidden="true">403</p>
      <h1 id="forbidden-title" class="error-page__title">
        {{ 'page.forbidden.title' | t }}
      </h1>
      <p class="error-page__message">{{ 'page.forbidden.message' | t }}</p>
      <a class="site-button" routerLink="/app/inicio">
        {{ 'common.backHome' | t }}
      </a>
    </section>
  `,
  styles: `
    .error-page {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2.5rem 1.5rem;
      border: 1px solid var(--site-border);
      border-radius: var(--site-radius);
      background: var(--site-surface);
      text-align: center;
    }

    .error-page__code {
      font-size: 2.5rem;
      font-weight: 800;
      line-height: 1;
      color: var(--site-primary);
    }

    .error-page__title {
      font-size: 1.4rem;
    }

    .error-page__message {
      max-width: 46ch;
      color: var(--site-muted);
    }
  `,
})
export class ForbiddenPage {}
