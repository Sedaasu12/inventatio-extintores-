import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService, TranslationParams } from './i18n.service';
import { TranslationKey } from './es-PE';

/** Resuelve una clave del diccionario activo: `{{ 'nav.inventory' | t }}`. */
@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: TranslationKey, params?: TranslationParams): string {
    return this.i18n.translate(key, params);
  }
}
