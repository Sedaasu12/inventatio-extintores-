import { registerLocaleData } from '@angular/common';
import localeEsPe from '@angular/common/locales/es-PE';

/**
 * Un solo idioma activo (D-30). Cambiar de idioma implica añadir otro archivo
 * de traducción y ajustar estas constantes, sin tocar los componentes.
 */
export const APP_LOCALE = 'es-PE';

/** Zona horaria de presentación (D-15). */
export const APP_TIME_ZONE = 'America/Lima';

registerLocaleData(localeEsPe, APP_LOCALE);
