import { Component } from '@angular/core';
import { TPipe } from '../../core/i18n/t.pipe';

/**
 * Página de bienvenida. En 8B no consulta la API: los indicadores llegan en
 * la fase 10, cuando exista el módulo de tablero.
 */
@Component({
  selector: 'app-home-page',
  imports: [TPipe],
  template: `
    <section class="home" aria-labelledby="home-title">
      <h1 id="home-title" class="home__title">{{ 'page.home.title' | t }}</h1>
      <p class="home__message">{{ 'page.home.message' | t }}</p>
      <p class="home__note">{{ 'app.fullName' | t }}</p>
    </section>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.5rem;
      border: 1px solid var(--site-border);
      border-radius: var(--site-radius);
      background: var(--site-surface);
      box-shadow: var(--site-shadow);
    }

    .home__title {
      font-size: 1.5rem;
    }

    .home__message {
      max-width: 60ch;
    }

    .home__note {
      color: var(--site-muted);
      font-size: 0.875rem;
    }
  `,
})
export class HomePage {}
