import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { I18nService } from '../core/i18n/i18n.service';
import { TranslationKey } from '../core/i18n/es-PE';

/**
 * Los títulos de ruta se declaran como claves de traducción
 * (`title: 'page.title.home'`) y aquí se resuelven, de modo que no hay textos
 * visibles escritos en las rutas (D-30 / BR-197).
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly documentTitle = inject(Title);
  private readonly i18n = inject(I18nService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    const appName = this.i18n.translate('app.name');
    if (key === undefined) {
      this.documentTitle.setTitle(appName);
      return;
    }
    const pageTitle = this.i18n.has(key)
      ? this.i18n.translate(key as TranslationKey)
      : key;
    this.documentTitle.setTitle(`${pageTitle} · ${appName}`);
  }
}
