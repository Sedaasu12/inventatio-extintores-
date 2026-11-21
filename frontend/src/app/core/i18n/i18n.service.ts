import { Injectable } from '@angular/core';
import { ApiClientError } from '../api/api-error';
import { TranslationKey, TRANSLATIONS } from './es-PE';

export type TranslationParams = Record<string, string | number>;

@Injectable({ providedIn: 'root' })
export class I18nService {
  translate(key: TranslationKey, params?: TranslationParams): string {
    const template = TRANSLATIONS[key] ?? key;
    if (params === undefined) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name];
      return value === undefined ? match : String(value);
    });
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(TRANSLATIONS, key);
  }

  /**
   * Mensaje para el usuario a partir de un error de la API: traduce los
   * códigos conocidos y, para el resto, muestra el mensaje en español que ya
   * envía el servidor. El `code` estable nunca se traduce (T-UI-03).
   */
  translateError(error: ApiClientError): string {
    const key = `errors.codes.${error.code}`;
    if (this.has(key)) {
      return this.translate(key as TranslationKey);
    }
    const serverMessage = error.serverMessage.trim();
    if (serverMessage !== '') {
      return serverMessage;
    }
    return this.translate('errors.generic');
  }
}
