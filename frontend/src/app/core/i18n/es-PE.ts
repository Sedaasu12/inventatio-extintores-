/**
 * Diccionario único de la interfaz (D-30 / BR-195..198).
 *
 * Todos los textos visibles viven aquí y se consumen por clave con el pipe
 * `t`. No hay selector de idioma; añadir otro idioma es añadir un archivo con
 * las mismas claves.
 */
export const ES_PE = {
  'app.name': 'SITE',
  'app.fullName': 'Sistema de inventario y trazabilidad de extintores',
  'app.tagline': 'Inventario y trazabilidad de extintores',

  'common.loading': 'Cargando…',
  'common.retry': 'Reintentar',
  'common.cancel': 'Cancelar',
  'common.accept': 'Aceptar',
  'common.close': 'Cerrar',
  'common.search': 'Buscar',
  'common.clear': 'Limpiar',
  'common.yes': 'Sí',
  'common.no': 'No',
  'common.required': 'Este campo es obligatorio.',
  'common.tooLong': 'El texto es demasiado largo.',
  'common.unknown': 'Desconocido',
  'common.notAvailable': 'No disponible',
  'common.actions': 'Acciones',
  'common.name': 'Nombre',
  'common.email': 'Correo electrónico',
  'common.continue': 'Continuar',
  'common.backHome': 'Volver al inicio',

  'pagination.label': 'Paginación',
  'pagination.previous': 'Página anterior',
  'pagination.next': 'Página siguiente',
  'pagination.status': 'Página {page} de {totalPages}',
  'table.empty': 'No hay registros para mostrar.',
  'dialog.cancel': 'Cancelar',
  'dialog.confirm': 'Confirmar',

  'auth.login.title': 'Iniciar sesión',
  'auth.login.subtitle': 'Ingresa con tu correo y contraseña.',
  'auth.login.email': 'Correo electrónico',
  'auth.login.emailPlaceholder': 'usuario@empresa.com',
  'auth.login.password': 'Contraseña',
  'auth.login.passwordPlaceholder': 'Tu contraseña',
  'auth.login.submit': 'Ingresar',
  'auth.login.submitting': 'Ingresando…',
  'auth.login.showPassword': 'Mostrar contraseña',
  'auth.login.hidePassword': 'Ocultar contraseña',
  'auth.login.recoveryNote':
    'La recuperación de contraseña es administrativa. Contacta al administrador.',
  'auth.login.sessionExpired': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'auth.login.changePending':
    'Debes cambiar tu contraseña antes de continuar.',
  'auth.logout': 'Cerrar sesión',
  'auth.session.checking': 'Verificando sesión…',

  'auth.changePassword.title': 'Cambia tu contraseña',
  'auth.changePassword.subtitle':
    'Por seguridad, reemplaza la contraseña temporal antes de continuar.',
  'auth.changePassword.current': 'Contraseña actual',
  'auth.changePassword.new': 'Nueva contraseña',
  'auth.changePassword.confirm': 'Repite la nueva contraseña',
  'auth.changePassword.submit': 'Cambiar contraseña',
  'auth.changePassword.submitting': 'Guardando…',
  'auth.changePassword.policy':
    'Entre 12 y 128 caracteres. No se exigen símbolos obligatorios.',
  'auth.changePassword.mismatch': 'Las contraseñas no coinciden.',
  'auth.changePassword.sameAsCurrent':
    'La nueva contraseña debe ser distinta de la actual.',
  'auth.changePassword.success':
    'Contraseña actualizada. Ya puedes continuar.',
  'auth.changePassword.currentInvalid': 'La contraseña actual no es correcta.',
  'auth.changePassword.forced':
    'Debes cambiar la contraseña para continuar.',

  'auth.errors.invalidCredentials':
    'El correo o la contraseña no son correctos.',
  'auth.errors.rateLimited':
    'Demasiados intentos. Espera {seconds} segundos antes de reintentar.',
  'auth.errors.emailRequired': 'Ingresa tu correo electrónico.',
  'auth.errors.emailInvalid': 'Ingresa un correo electrónico válido.',
  'auth.errors.passwordRequired': 'Ingresa tu contraseña.',

  'nav.dashboard': 'Inicio',
  'nav.inventory': 'Inventario',
  'nav.movements': 'Movimientos',
  'nav.scan': 'Escanear',
  'nav.locations': 'Ubicaciones',
  'nav.maintenance': 'Mantenimiento',
  'nav.inspections': 'Inspecciones',
  'nav.alerts': 'Alertas',
  'nav.reports': 'Reportes',
  'nav.admin': 'Administración',

  'inventory.title': 'Inventario de extintores',
  'inventory.subtitle':
    'Consulta los activos registrados, su ubicación actual, estado logístico y condición técnica.',
  'inventory.filters.title': 'Filtros',
  'inventory.filters.search': 'Buscar',
  'inventory.filters.searchPlaceholder': 'Código, serial, marca o modelo',
  'inventory.filters.type': 'Tipo',
  'inventory.filters.allTypes': 'Todos los tipos',
  'inventory.filters.location': 'Ubicación',
  'inventory.filters.allLocations': 'Todas las ubicaciones',
  'inventory.filters.logisticsStatus': 'Estado logístico',
  'inventory.filters.allStatuses': 'Todos los estados',
  'inventory.filters.technicalCondition': 'Condición técnica',
  'inventory.filters.allConditions': 'Todas las condiciones',
  'inventory.filters.sort': 'Orden',
  'inventory.filters.includeRetired': 'Incluir dados de baja',
  'inventory.filters.apply': 'Aplicar filtros',
  'inventory.filters.clear': 'Limpiar filtros',
  'inventory.loading': 'Cargando extintores…',
  'inventory.results': 'Mostrando {count} de {total} extintores.',
  'inventory.tableCaption': 'Listado de extintores',
  'inventory.empty.title': 'Sin extintores',
  'inventory.empty.filtered':
    'No hay extintores que coincidan con los filtros seleccionados.',
  'inventory.empty.none': 'Aún no hay extintores registrados.',
  'inventory.columns.assetCode': 'Código',
  'inventory.columns.type': 'Tipo',
  'inventory.columns.location': 'Ubicación actual',
  'inventory.columns.logisticsStatus': 'Estado logístico',
  'inventory.columns.technicalCondition': 'Condición técnica',
  'inventory.columns.serialNumber': 'Serial',
  'inventory.columns.updatedAt': 'Actualizado',
  'inventory.logistics.EN_ALMACEN': 'En almacén',
  'inventory.logistics.ASIGNADO': 'Asignado',
  'inventory.logistics.EN_MANTENIMIENTO': 'En mantenimiento',
  'inventory.logistics.DADO_DE_BAJA': 'Dado de baja',
  'inventory.condition.OPERATIVO': 'Operativo',
  'inventory.condition.OBSERVADO': 'Observado',
  'inventory.condition.NO_OPERATIVO': 'No operativo',
  'inventory.condition.PENDIENTE_INSPECCION': 'Pendiente de inspección',
  'inventory.sort.assetCodeAsc': 'Código (A–Z)',
  'inventory.sort.assetCodeDesc': 'Código (Z–A)',
  'inventory.sort.createdAtAsc': 'Alta (más antigua)',
  'inventory.sort.createdAtDesc': 'Alta (más reciente)',
  'inventory.sort.updatedAtAsc': 'Actualización (más antigua)',
  'inventory.sort.updatedAtDesc': 'Actualización (más reciente)',
  'inventory.sort.serialNumberAsc': 'Serial (A–Z)',
  'inventory.sort.serialNumberDesc': 'Serial (Z–A)',

  'shell.skipToContent': 'Ir al contenido principal',
  'shell.openMenu': 'Abrir menú',
  'shell.closeMenu': 'Cerrar menú',
  'shell.mainNavigation': 'Navegación principal',
  'shell.userMenu': 'Menú de usuario',
  'shell.currentUser': 'Sesión de {name}',
  'shell.sessionClosing': 'Cerrando sesión…',
  'shell.logoutConfirm': '¿Cerrar la sesión actual?',

  'page.home.title': 'Bienvenido a SITE',
  'page.home.message':
    'Usa el menú para consultar el inventario y registrar operaciones.',
  'page.forbidden.title': 'Sin permiso',
  'page.forbidden.message': 'No tienes permiso para ver esta sección.',
  'page.notFound.title': 'Página no encontrada',
  'page.notFound.message': 'La dirección solicitada no existe.',
  'page.title.login': 'Iniciar sesión',
  'page.title.home': 'Inicio',
  'page.title.inventory': 'Inventario',
  'page.title.changePassword': 'Cambiar contraseña',
  'page.title.forbidden': 'Sin permiso',
  'page.title.notFound': 'Página no encontrada',

  'errors.generic': 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  'errors.requestId': 'Referencia del error: {requestId}',
  'errors.codes.UNAUTHENTICATED': 'Tu sesión expiró. Vuelve a iniciar sesión.',
  'errors.codes.FORBIDDEN': 'No tienes permiso para realizar esta acción.',
  'errors.codes.PASSWORD_CHANGE_REQUIRED':
    'Debes cambiar tu contraseña antes de continuar.',
  'errors.codes.NOT_FOUND': 'El recurso solicitado no existe.',
  'errors.codes.TOO_MANY_REQUESTS':
    'Demasiadas solicitudes. Espera un momento antes de reintentar.',
  'errors.codes.NETWORK_ERROR':
    'No se pudo conectar con el servidor. Revisa tu conexión.',
  'errors.codes.UNKNOWN_ERROR': 'Ocurrió un error inesperado.',
  'errors.codes.INTERNAL_ERROR':
    'El servidor no pudo completar la operación. Inténtalo más tarde.',
  'errors.codes.IDEMPOTENCY_CONFLICT':
    'La operación ya se registró con otros datos. Recarga e inténtalo de nuevo.',
  'errors.codes.CONCURRENCY_CONFLICT':
    'Otro usuario modificó este registro. Recarga e inténtalo de nuevo.',
  'errors.codes.INVALID_CURRENT_PASSWORD':
    'La contraseña actual no es correcta.',
} as const;

export type TranslationKey = keyof typeof ES_PE;

export const TRANSLATIONS: Record<string, string> = ES_PE;
