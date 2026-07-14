/**
 * @file Capa de servicio API para collectors-forge-studio.
 *
 * Configura una instancia de Axios con la URL base del backend,
 * interceptores de solicitud para inyectar el token JWT de autenticacion,
 * e interceptores de respuesta para manejar errores 401 (no autorizado)
 * redirigiendo automaticamente al usuario a la pagina de login.
 *
 * Exporta funciones para todas las operaciones del API:
 * - Autenticacion (login, registro, perfil)
 * - CRUD de filamentos (legacy)
 * - CRUD de impresoras
 * - CRUD de insumos adicionales (legacy)
 * - Inventario (items de stock, incluyendo filamentos e insumos)
 * - Configuracion de la aplicacion (incluye tasa de cambio y tarifas EPM)
 * - Cotizaciones (calcular con inventory_item_id, crear, listar, descargar PDF)
 *
 * @module services/api
 */

import axios from 'axios';

/**
 * Instancia de Axios preconfigurada con la URL base '/api'.
 * Todas las llamadas al backend se realizan a traves de esta instancia.
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: '/api',
});

/**
 * Interceptor de solicitud: agrega el header Authorization con el token JWT
 * almacenado en localStorage antes de cada peticion HTTP.
 * Si no existe token, la solicitud se envia sin header de autorizacion.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Interceptor de respuesta: maneja globalmente los errores HTTP.
 * Si el servidor responde con 401 (no autorizado), elimina el token
 * de localStorage y redirige al usuario a la pagina de login.
 * Cualquier otro error se rechaza normalmente para que lo maneje el llamador.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // M-05: usar evento en lugar de window.location para que React Router
      // maneje la navegación y DirtyStateContext pueda advertir al usuario.
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// Autenticacion
// ============================================================================

/**
 * Inicia sesion del usuario enviando credenciales como form-urlencoded.
 * El backend espera este formato para la autenticacion OAuth2.
 *
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contrasena del usuario
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con access_token en data
 */
export const login = (username, password) => {
  // Se usa URLSearchParams para enviar los datos como application/x-www-form-urlencoded,
  // requerido por el endpoint OAuth2 de FastAPI
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);
  return api.post('/auth/login', formData);
};

/**
 * Obtiene los datos del usuario autenticado actual.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos del usuario en data
 */
export const getMe = () => api.get('/auth/me');

/**
 * Indica si el backend tiene habilitado el bypass de login de dev
 * (DEV_LOGIN_ENABLED — solo true en el deploy de cfs-app-dev, nunca en prod).
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con { enabled: boolean }
 */
export const getDevLoginStatus = () => api.get('/auth/oidc/dev-login-status');

/**
 * Registra un nuevo usuario en el sistema.
 *
 * @param {Object} data - Datos del nuevo usuario
 * @param {string} data.username - Nombre de usuario
 * @param {string} data.password - Contrasena
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos del usuario creado
 */
export const register = (data) => api.post('/auth/register', data);

// ============================================================================
// Empresa
// ============================================================================

export const getCompany = () => api.get('/company/');
export const updateCompany = (data) => api.put('/company/', data);
export const uploadCompanyLogo = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/company/logo', fd);
};

// ============================================================================
// Usuario actual
// ============================================================================

export const updateMe       = (data)         => api.put('/users/me', data);
export const getUsers       = ()              => api.get('/users/');
export const updateUser     = (id, data)     => api.patch(`/users/${id}`, data);

// ============================================================================
// Filamentos
// ============================================================================

/**
 * Obtiene la lista completa de filamentos del usuario.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con array de filamentos en data
 */
export const getFilaments = () => api.get('/filaments/');

/**
 * Obtiene los datos de un filamento especifico por su ID.
 *
 * @param {number} id - ID del filamento
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos del filamento
 */
export const getFilament = (id) => api.get(`/filaments/${id}`);

/**
 * Crea un nuevo filamento.
 *
 * @param {Object} data - Datos del filamento
 * @param {string} data.brand - Marca del filamento
 * @param {string} data.type - Tipo de material (PLA, PETG, ABS, etc.)
 * @param {string} data.color - Color del filamento
 * @param {number} data.price_per_kg - Precio por kilogramo
 * @param {number} data.weight_per_roll - Peso por rollo en gramos
 * @param {number} data.diameter - Diametro del filamento en mm
 * @param {number} data.density - Densidad del material
 * @param {string|null} data.notes - Notas adicionales opcionales
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el filamento creado
 */
export const createFilament = (data) => api.post('/filaments/', data);

/**
 * Actualiza un filamento existente.
 *
 * @param {number} id - ID del filamento a actualizar
 * @param {Object} data - Datos actualizados del filamento (misma estructura que createFilament)
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el filamento actualizado
 */
export const updateFilament = (id, data) => api.put(`/filaments/${id}`, data);

/**
 * Elimina un filamento por su ID.
 *
 * @param {number} id - ID del filamento a eliminar
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta de confirmacion
 */
export const deleteFilament = (id) => api.delete(`/filaments/${id}`);

// ============================================================================
// Impresoras
// ============================================================================

/**
 * Obtiene la lista completa de impresoras 3D del usuario.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con array de impresoras en data
 */
export const getPrinters = () => api.get('/printers/');

/**
 * Obtiene los datos de una impresora especifica por su ID.
 *
 * @param {number} id - ID de la impresora
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos de la impresora
 */
export const getPrinter = (id) => api.get(`/printers/${id}`);

/**
 * Crea una nueva impresora 3D.
 *
 * @param {Object} data - Datos de la impresora
 * @param {string} data.name - Nombre de la impresora
 * @param {string} data.model - Modelo de la impresora
 * @param {number} data.purchase_price - Precio de compra
 * @param {number} data.power_consumption_watts - Consumo electrico en watts
 * @param {number} data.estimated_lifespan_hours - Vida util estimada en horas
 * @param {number} data.current_hours - Horas de uso actual
 * @param {string|null} data.notes - Notas adicionales opcionales
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con la impresora creada
 */
export const createPrinter = (data) => api.post('/printers/', data);

/**
 * Actualiza una impresora existente.
 *
 * @param {number} id - ID de la impresora a actualizar
 * @param {Object} data - Datos actualizados (misma estructura que createPrinter)
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con la impresora actualizada
 */
export const updatePrinter = (id, data) => api.put(`/printers/${id}`, data);

/**
 * Elimina una impresora por su ID.
 *
 * @param {number} id - ID de la impresora a eliminar
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta de confirmacion
 */
export const deletePrinter = (id) => api.delete(`/printers/${id}`);

// ============================================================================
// Configuracion
// ============================================================================

/**
 * Obtiene la configuracion actual de la aplicacion.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos de configuracion
 */
export const getSettings = () => api.get('/settings/');

/**
 * Actualiza la configuracion de la aplicacion.
 *
 * @param {Object} data - Datos de configuracion
 * @param {number} data.electricity_rate - Tarifa electrica por kWh
 * @param {number} data.failure_rate_percent - Porcentaje de tasa de fallos
 * @param {number} data.labor_cost_per_hour - Costo de mano de obra por hora
 * @param {number} data.default_margin_percent - Margen de ganancia por defecto
 * @param {string} data.currency - Codigo de moneda (USD, EUR, MXN, etc.)
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con la configuracion actualizada
 */
export const updateSettings = (data) => api.put('/settings/', data);

// ============================================================================
// Cotizaciones
// ============================================================================

/**
 * Calcula el costo de una cotizacion sin guardarla.
 * Retorna el desglose completo de costos (material, electricidad,
 * depreciacion, mantenimiento, mano de obra, fallos, margen, total).
 *
 * El filamento principal y los filamentos adicionales se referencian
 * mediante inventory_item_id (item de inventario con category="Filamento").
 * Los insumos adicionales tambien se referencian por inventory_item_id.
 *
 * @param {Object} data - Datos de la pieza a cotizar
 * @param {string} data.piece_name - Nombre de la pieza
 * @param {string|null} data.description - Descripcion opcional de la pieza
 * @param {string|null} data.client_name - Nombre del cliente opcional
 * @param {string} data.inventory_item_id - UUID del item de inventario (filamento) principal
 * @param {number} data.printer_id - ID de la impresora a utilizar
 * @param {number} data.weight_grams - Peso del filamento en gramos
 * @param {number} data.print_time_hours - Tiempo de impresion en horas
 * @param {number} data.preparation_time_hours - Tiempo de preparacion en horas
 * @param {number} data.post_processing_time_hours - Tiempo de post-procesado en horas
 * @param {number} data.quantity - Cantidad de unidades
 * @param {number} data.margin_percent - Porcentaje de margen de ganancia
 * @param {Array} data.supplies - Insumos adicionales [{inventory_item_id, quantity}]
 * @param {Array} data.additional_filaments - Filamentos adicionales [{inventory_item_id, weight_grams}]
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el desglose de costos
 */
export const calculateQuote = (data) => api.post('/quotes/calculate', data);

/**
 * Calcula el costo de una cotizacion manual (sin filamento/impresora registrados).
 * Permite calcular el desglose proporcionando todos los parametros directamente.
 *
 * @param {Object} data - Datos completos de la cotizacion manual
 * @param {string} data.piece_name - Nombre de la pieza
 * @param {string} data.filament_name - Nombre descriptivo del material
 * @param {number} data.price_per_kg - Precio del filamento en USD/kg
 * @param {number} data.power_consumption_watts - Consumo de la impresora en watts
 * @param {number} data.purchase_price - Precio de compra de la impresora en USD
 * @param {number} data.estimated_lifespan_hours - Vida util de la impresora en horas
 * @param {number} data.weight_grams - Peso del filamento en gramos
 * @param {number} data.print_time_hours - Tiempo de impresion en horas
 * @param {number} data.quantity - Cantidad de unidades
 * @param {number|null} data.margin_percent - Porcentaje de margen (null = usa el default)
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el desglose de costos
 */
export const calculateManualQuote = (data) => api.post('/quotes/calculate/manual', data);

/**
 * Crea y guarda una cotizacion en el historial.
 *
 * Utiliza inventory_item_id para referenciar el filamento principal y los
 * filamentos adicionales, asi como los insumos adicionales del inventario.
 *
 * @param {Object} data - Datos de la cotizacion (misma estructura que calculateQuote)
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con la cotizacion creada
 */
export const createQuote = (data) => api.post('/quotes/', data);

/**
 * Obtiene el historial completo de cotizaciones del usuario.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con array de cotizaciones en data
 */
export const getQuotes = () => api.get('/quotes/');

/**
 * Obtiene los datos de una cotizacion especifica por su ID.
 *
 * @param {number} id - ID de la cotizacion
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos de la cotizacion
 */
export const getQuote = (id) => api.get(`/quotes/${id}`);

/**
 * Elimina una cotizacion por su ID.
 *
 * @param {number} id - ID de la cotizacion a eliminar
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta de confirmacion
 */
export const deleteQuote = (id) => api.delete(`/quotes/${id}`);
export const updateQuote = (id, data) => api.put(`/quotes/${id}`, data);

/**
 * Descarga el PDF de una cotizacion.
 * Retorna la respuesta como Blob para poder crear un enlace de descarga.
 *
 * @param {number} id - ID de la cotizacion
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el archivo PDF como Blob
 */
export const downloadQuotePdf = (id) =>
  api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });

// ============================================================================
// Cotizaciones de cliente (multi-producto)
// ============================================================================

/**
 * Crea y guarda una cotización de cliente con múltiples líneas de producto.
 *
 * @param {Object} data - Datos de la cotización
 * @param {string} data.client_name - Nombre del cliente
 * @param {string|null} data.description - Descripción general opcional
 * @param {string} data.quote_date - Fecha de emisión (YYYY-MM-DD)
 * @param {number} data.expiry_days - Días de vigencia
 * @param {Array} data.items - Líneas de producto [{name, quantity, unit_price}]
 * @param {string|null} data.notes - Notas adicionales opcionales
 * @returns {Promise<import('axios').AxiosResponse>} Cotización creada
 */
export const createClientQuote = (data) => api.post('/client-quotes/', data);

/**
 * Obtiene el historial de cotizaciones de cliente de la empresa.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Array de cotizaciones
 */
export const getClientQuotes = () => api.get('/client-quotes/');

/**
 * Obtiene una cotización de cliente por su ID.
 *
 * @param {number} id - ID de la cotización
 * @returns {Promise<import('axios').AxiosResponse>} Datos de la cotización
 */
export const getClientQuote = (id) => api.get(`/client-quotes/${id}`);

/**
 * Elimina una cotización de cliente por su ID.
 *
 * @param {number} id - ID de la cotización a eliminar
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta de confirmación
 */
export const deleteClientQuote = (id) => api.delete(`/client-quotes/${id}`);

/**
 * Descarga el PDF de una cotización de cliente.
 *
 * @param {number} id - ID de la cotización
 * @returns {Promise<import('axios').AxiosResponse>} PDF como Blob
 */
export const downloadClientQuotePdf = (id) =>
  api.get(`/client-quotes/${id}/pdf`, { responseType: 'blob' });

// ============================================================================
// Insumos
// ============================================================================

/**
 * Obtiene la lista completa de insumos adicionales del usuario.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con array de insumos en data
 */
export const getSupplies = () => api.get('/supplies/');

/**
 * Crea un nuevo insumo adicional.
 *
 * @param {Object} data - Datos del insumo
 * @param {string} data.name - Nombre del insumo
 * @param {string|null} data.description - Descripcion opcional
 * @param {string} data.unit - Unidad base (unidad, pieza, cm, gramo)
 * @param {number} data.pack_qty - Cantidad de unidades por paquete
 * @param {number} data.pack_price - Precio del paquete en USD
 * @param {string|null} data.notes - Notas adicionales opcionales
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el insumo creado (incluye price_per_unit)
 */
export const createSupply = (data) => api.post('/supplies/', data);

/**
 * Actualiza un insumo existente.
 *
 * @param {number} id - ID del insumo a actualizar
 * @param {Object} data - Datos actualizados (misma estructura que createSupply)
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el insumo actualizado
 */
export const updateSupply = (id, data) => api.put(`/supplies/${id}`, data);

/**
 * Elimina un insumo por su ID.
 *
 * @param {number} id - ID del insumo a eliminar
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta de confirmacion
 */
export const deleteSupply = (id) => api.delete(`/supplies/${id}`);

// ============================================================================
// Informacion de mercado (tasa de cambio y tarifas electricas)
// ============================================================================

/**
 * Obtiene la tasa de cambio USD a COP actualmente en uso por la aplicacion.
 * Incluye la tasa de mercado, el markup configurado y la tasa final usada en calculos.
 * Se actualiza automaticamente cada hora desde open.er-api.com.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con market_rate, markup y rate_used
 */
export const getExchangeRate = () => api.get('/settings/exchange-rate');

/**
 * Obtiene la tarifa de electricidad EPM del mes actual.
 * Incluye todos los estratos (1-6), cada uno con su tarifa en COP/kWh
 * y su equivalente en USD/kWh (aplicando el multiplicador configurado).
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con available, month_label, estratos y multiplier
 */
export const getElectricityTariff = () => api.get('/settings/electricity-tariff');

/**
 * Obtiene el historial completo de tarifas EPM guardadas en la base de datos,
 * agrupado por mes. Permite consultar y aplicar tarifas de meses anteriores.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con array de entradas mensuales, cada una con month_label, estratos y multiplier
 */
export const getElectricityTariffs = () => api.get('/settings/electricity-tariffs');

/**
 * Fuerza un re-scrape inmediato de la tarifa EPM ignorando el caché de 24h (solo admin).
 *
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con available y datos actualizados
 */
export const refreshElectricityTariff = () => api.post('/settings/electricity-tariff/refresh');

// ============================================================================
// Inventario - Ítems de stock
// ============================================================================

/** Obtiene todos los ítems de inventario de la empresa. */
export const getInventoryItems = () => api.get('/inventory/items/');

/**
 * Obtiene los items de inventario con category="Filamento".
 * Estos reemplazan a la tabla legacy de filamentos en la calculadora.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Array de items de inventario tipo Filamento
 */
export const getInventoryFilaments = () => api.get('/inventory/items/?category=Filamento');

/**
 * Obtiene todos los items de inventario para usarlos como insumos en la calculadora.
 * El componente debe filtrar los que NO son "Filamento" para mostrar solo insumos.
 *
 * @returns {Promise<import('axios').AxiosResponse>} Array de todos los items de inventario
 */
export const getInventorySupplies = () => api.get('/inventory/items/');

/** Crea un nuevo ítem de inventario. */
export const createInventoryItem = (data) => api.post('/inventory/items/', data);

/** Actualiza un ítem de inventario existente. */
export const updateInventoryItem = (id, data) => api.put(`/inventory/items/${id}`, data);

/** Elimina un ítem de inventario. */
export const deleteInventoryItem = (id) => api.delete(`/inventory/items/${id}`);

/** Alterna la bandera "necesita compra" de un ítem. */
export const flagInventoryItem = (id) => api.patch(`/inventory/items/${id}/flag`);

/** Ajusta la cantidad de un ítem (suma o resta). */
export const adjustInventoryItem = (id, quantity) =>
  api.patch(`/inventory/items/${id}/adjust`, { quantity });

// ============================================================================
// Inventario - Pedidos de compra
// ============================================================================

/** Obtiene todos los pedidos de compra de la empresa. */
export const getPurchaseOrders = () => api.get('/inventory/purchases/');

/** Crea un nuevo pedido de compra con sus ítems. */
export const createPurchaseOrder = (data) => api.post('/inventory/purchases/', data);

/** Obtiene un pedido de compra por ID. */
export const getPurchaseOrder = (id) => api.get(`/inventory/purchases/${id}`);

/** Actualiza los datos del pedido (sin ítems). */
export const updatePurchaseOrder = (id, data) => api.put(`/inventory/purchases/${id}`, data);

/** Elimina un pedido de compra. */
export const deletePurchaseOrder = (id) => api.delete(`/inventory/purchases/${id}`);

/** Marca un pedido como llegado y actualiza el stock de inventario. */
export const arrivePurchaseOrder = (id) => api.post(`/inventory/purchases/${id}/arrive`);

// ============================================================
// Impresiones (Printed Items)
// ============================================================

/** Obtiene todos los ítems de impresiones de la empresa. */
export const getPrintedItems = (params) => api.get('/inventory/prints/', { params });

/** Crea un nuevo ítem de impresión. */
export const createPrintedItem = (data) => api.post('/inventory/prints/', data);

/** Obtiene un ítem de impresión por ID. */
export const getPrintedItem = (id) => api.get(`/inventory/prints/${id}`);

/** Actualiza un ítem de impresión. */
export const updatePrintedItem = (id, data) => api.put(`/inventory/prints/${id}`, data);

/** Elimina un ítem de impresión. */
export const deletePrintedItem = (id) => api.delete(`/inventory/prints/${id}`);

/** Registra una venta (decrementa el stock). */
export const sellPrintedItem = (id, quantity) => api.post(`/inventory/prints/${id}/sell`, { quantity });

/** Descarga todo el inventario de la empresa como blob JSON. */
export const exportInventory = () =>
  api.get('/inventory/items/export', { responseType: 'blob' });

/** Importa inventario desde un objeto JSON exportado previamente. */
export const importInventory = (data) =>
  api.post('/inventory/items/import', data);

/** Sube una imagen para un ítem de impresión. */
export const uploadPrintedItemImage = (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/inventory/prints/${id}/image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ============================================================================
// Mantenimiento de impresoras
// ============================================================================
// Las impresoras se gestionan con getPrinters() / updatePrinter() de la app Cost.

/**
 * Lista los registros de mantenimiento.
 * @param {number|null} printerId - Filtrar por impresora (opcional)
 */
export const getMaintenanceLogs = (printerId = null) => {
  const params = printerId != null ? { printer_id: printerId } : {};
  return api.get('/maintenance/logs/', { params });
};

/** Crea un registro de mantenimiento (descuenta inventario automáticamente). */
export const createMaintenanceLog = (data) => api.post('/maintenance/logs/', data);

/** Obtiene el detalle de un registro de mantenimiento. */
export const getMaintenanceLog = (id) => api.get(`/maintenance/logs/${id}`);

/** Actualiza fecha, horas, tipo y descripción de un registro (no modifica ítems). */
export const updateMaintenanceLog = (id, data) => api.put(`/maintenance/logs/${id}`, data);

/** Elimina un registro de mantenimiento. */
export const deleteMaintenanceLog = (id) => api.delete(`/maintenance/logs/${id}`);

/** Obtiene el resumen de mantenimiento por impresora (dashboard). */
export const getMaintenanceSummary = () => api.get('/maintenance/summary/');

// ============================================================================
// Empresa — Templates de cotización (Liquid + WeasyPrint)
// ============================================================================

/** Obtiene todos los templates de cotización de la empresa. */
export const getCompanyTemplates = () => api.get('/company/templates/');

/** Obtiene un template por ID. */
export const getCompanyTemplate = (id) => api.get(`/company/templates/${id}`);

/** Crea un nuevo template de cotización. */
export const createCompanyTemplate = (data) => api.post('/company/templates/', data);

/** Actualiza un template existente. */
export const updateCompanyTemplate = (id, data) => api.put(`/company/templates/${id}`, data);

/** Elimina un template. */
export const deleteCompanyTemplate = (id) => api.delete(`/company/templates/${id}`);

/** Marca un template como default para su tipo. */
export const setDefaultTemplate = (id) => api.post(`/company/templates/${id}/set-default`);

/** Valida el contenido Liquid de un template. Retorna {ok, errors, warnings, preview_pdf_b64}. */
export const validateTemplate = (data) => api.post('/company/templates/validate', data);

/** Descarga un PDF de muestra del template indicado. */
export const previewTemplate = (id) => api.get(`/company/templates/${id}/preview`, { responseType: 'blob' });

/** Obtiene el contenido del template Liquid por defecto del sistema. */
export const getDefaultTemplateContent = () => api.get('/company/templates/default-template');

// ============================================================================
// Inventario - Categorías configurables
// ============================================================================

/** Obtiene todas las categorías de inventario de la empresa. */
export const getInventoryCategories = () => api.get('/inventory/categories/');

/** Crea una nueva categoría de inventario. */
export const createInventoryCategory = (data) => api.post('/inventory/categories/', data);

/** Actualiza una categoría de inventario (nombre o allows_decimals). */
export const updateInventoryCategory = (id, data) => api.put(`/inventory/categories/${id}`, data);

/** Elimina una categoría de inventario (no aplica a categorías de sistema). */
export const deleteInventoryCategory = (id) => api.delete(`/inventory/categories/${id}`);

// ============================================================================
// Cola de impresión (Queue)
// ============================================================================

/** Lista los ítems activos de la cola (pending + printing), ordenados por posición. */
export const getQueue = () => api.get('/queue/');

/** Lista los últimos 50 ítems completados o cancelados. */
export const getQueueHistory = () => api.get('/queue/history');

/** Agrega una cotización guardada a la cola de impresión. */
export const addToQueue = (data) => api.post('/queue/', data);

/**
 * Agrega un modelo del Vault (con .gcode.3mf) a la cola. Backend denormaliza
 * peso/tiempo/printer/filament en el item para que cambios futuros en el
 * Vault no afecten items ya encolados.
 *
 * @param {Object} data
 * @param {number} data.vault_model_id
 * @param {number} data.printer_id
 * @param {number} [data.filament_id]
 * @param {number} [data.quantity=1]
 * @param {string} [data.notes]
 */
export const addToQueueFromVault = (data) =>
  api.post('/queue/from-vault', data);

/** Cambia el estado de un ítem de la cola (printing | done | cancelled). */
export const updateQueueStatus = (id, data) => api.put(`/queue/${id}/status`, data);

/** Elimina un ítem de la cola (solo si pending o cancelled). */
export const deleteQueueItem = (id) => api.delete(`/queue/${id}`);

/**
 * Reordena la cola por drag-and-drop (issue #133). `itemIds` debe ser la
 * lista COMPLETA de ids `pending` actuales, en el nuevo orden deseado.
 */
export const reorderQueue = (itemIds) => api.put('/queue/reorder', { item_ids: itemIds });

/** Agrupa ≥2 ítems pending como lote — devuelve los items con batch_id asignado. */
export const createQueueBatch = (itemIds) => api.post('/queue/batch', { item_ids: itemIds });

/** Desagrupa un lote — pone batch_id=NULL a todos sus miembros. */
export const deleteQueueBatch = (batchId) => api.delete(`/queue/batch/${batchId}`);

/** Clona un ítem de la cola como uno nuevo pending al final. */
export const duplicateQueueItem = (id) => api.post(`/queue/${id}/duplicate`);

/** Programa (o quita programación de, con `null`) un ítem. Puramente organizativo. */
export const scheduleQueueItem = (id, scheduledAt) =>
  api.put(`/queue/${id}/schedule`, { scheduled_at: scheduledAt });

// ============================================================================
// Vault — archivos .3mf
// ============================================================================

/** Lista los archivos del Vault (paginado, búsqueda opcional por nombre). */
export const getVaultFiles = (params) => api.get('/vault/', { params });

/** Retorna el uso y cuota de almacenamiento de la empresa. */
export const getVaultStats = () => api.get('/vault/stats');

/**
 * Pre-lee metadata de un modelo desde su URL pública (MakerWorld, Printables, OG).
 * @param {string} url - URL del modelo
 */
export const fetchVaultMetadata = (url) => api.post('/vault/fetch-metadata', { url });

/**
 * Sube source_file (.3mf editable) y/o print_file (.gcode.3mf laminado) al
 * Vault con metadata compartida. Al menos uno tiene que estar presente.
 *
 * El caller arma el FormData con las claves:
 *   - `metadata`     (string JSON con ModelFileCreate)
 *   - `source_file`  (File, opcional)
 *   - `print_file`   (File, opcional)
 *
 * @param {FormData} formData
 * @param {Function} [onUploadProgress] - Callback axios para barra de progreso
 */
export const uploadVaultFile = (formData, onUploadProgress) =>
  api.post('/vault/upload', formData, { onUploadProgress });

/**
 * Descarga el .3mf/.stl editable de un modelo. 404 si el modelo no lo tiene.
 * @param {number} id - ID del archivo en el Vault
 */
export const downloadVaultSource = (id) =>
  api.get(`/vault/${id}/download/source`, { responseType: 'blob' });

/**
 * Descarga el .gcode.3mf laminado de un modelo. 404 si no lo tiene.
 * @param {number} id - ID del archivo en el Vault
 */
export const downloadVaultPrint = (id) =>
  api.get(`/vault/${id}/download/print`, { responseType: 'blob' });

/**
 * Extrae el G-code plano del plate activo de un `.gcode.3mf` (issue #129).
 * Usado por el visor `GCodeViewerModal` (gcode-preview). 404 si el modelo
 * no tiene print_file, 413 si el G-code supera 80 MB.
 * @param {number} id - ID del archivo en el Vault
 */
export const getVaultGcodeContent = (id) =>
  api.get(`/vault/${id}/gcode-content`, { responseType: 'text' });

/**
 * Obtiene un solo archivo del Vault por ID. Usado por el editor para
 * pre-llenar el formulario cuando el path incluye `?replace=<id>`.
 * @param {number} id
 */
export const getVaultFile = (id) => api.get(`/vault/${id}`);

/**
 * Cambia el plate activo de un modelo del Vault (issue #68).
 * Backend sincroniza sliced_* + thumbnail principal al plate elegido.
 * @param {number} id - ID del modelo
 * @param {number} plateIndex - 0-based
 */
export const setActiveVaultPlate = (id, plateIndex) =>
  api.patch(`/vault/${id}/active-plate`, null, { params: { plate_index: plateIndex } });

/**
 * Actualiza los metadatos de un archivo del Vault (solo admins).
 * @param {number} id - ID del archivo
 * @param {Object} data - Campos a actualizar
 */
export const updateVaultFile = (id, data) => api.put(`/vault/${id}`, data);

/**
 * Historial de impresiones de un modelo del Vault + gramos totales y tasa
 * de éxito agregados (issue #130).
 * @param {number} id - ID del archivo en el Vault
 */
export const getVaultPrintHistory = (id) => api.get(`/vault/${id}/print-history`);

/**
 * Lista las fotos adjuntas a un modelo del Vault.
 * @param {number} id - ID del archivo en el Vault
 */
export const getVaultPhotos = (id) => api.get(`/vault/${id}/photos`);

/**
 * Sube hasta 5 fotos para un modelo del Vault (solo admins).
 * @param {number} id - ID del archivo en el Vault
 * @param {File[]} files - Archivos de imagen (jpeg/png/webp/gif, máx 10MB c/u)
 * @param {Function} [onUploadProgress]
 */
export const uploadVaultPhotos = (id, files, onUploadProgress) => {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  return api.post(`/vault/${id}/photos`, formData, { onUploadProgress });
};

/**
 * Edita el caption de una foto ya subida (solo admins).
 * @param {number} id - ID del archivo en el Vault
 * @param {number} photoId
 * @param {string|null} caption
 */
export const updateVaultPhotoCaption = (id, photoId, caption) =>
  api.patch(`/vault/${id}/photos/${photoId}`, { caption });

/**
 * Elimina una foto de un modelo del Vault (solo admins).
 * @param {number} id - ID del archivo en el Vault
 * @param {number} photoId
 */
export const deleteVaultPhoto = (id, photoId) => api.delete(`/vault/${id}/photos/${photoId}`);

/**
 * Reemplaza el slot `source` (.3mf editable) conservando metadatos. Solo admins.
 * @param {number} id
 * @param {File} file - Nuevo .3mf editable
 * @param {Function} [onUploadProgress]
 */
export const replaceVaultSource = (id, file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/vault/${id}/replace/source`, formData, { onUploadProgress });
};

/**
 * Reemplaza el slot `print` (.gcode.3mf laminado) conservando metadatos. Solo admins.
 * @param {number} id
 * @param {File} file - Nuevo .gcode.3mf
 * @param {Function} [onUploadProgress]
 */
export const replaceVaultPrint = (id, file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/vault/${id}/replace/print`, formData, { onUploadProgress });
};

/**
 * Mueve un archivo del Vault a la papelera (soft-delete, solo admins).
 * Los bytes en MinIO no se borran — eso pasa recién en `purgeVaultFile`.
 * @param {number} id - ID del archivo
 */
export const deleteVaultFile = (id) => api.delete(`/vault/${id}`);

// ── Tags del Vault ───────────────────────────────────────────────────────────

/** Lista el catálogo de tags del Vault (con conteo de archivos activos). */
export const getVaultTags = () => api.get('/vault/tags');

/** Crea un tag nuevo en el catálogo (solo admins). */
export const createVaultTag = (name) => api.post('/vault/tags', { name });

/** Renombra un tag existente — aplica a todos los archivos que lo usan (solo admins). */
export const updateVaultTag = (id, name) => api.patch(`/vault/tags/${id}`, { name });

/** Elimina un tag del catálogo (no borra los archivos, solo la etiqueta) (solo admins). */
export const deleteVaultTag = (id) => api.delete(`/vault/tags/${id}`);

// ── Papelera del Vault ───────────────────────────────────────────────────────

/** Lista los archivos en la papelera (paginado). */
export const getVaultTrash = (params) => api.get('/vault/trash', { params });

/** Restaura un archivo de la papelera (solo admins). */
export const restoreVaultFile = (id) => api.post(`/vault/trash/${id}/restore`);

/** Borrado permanente: bytes de MinIO + fila. Solo si ya está en la papelera (solo admins). */
export const purgeVaultFile = (id) => api.delete(`/vault/trash/${id}`);

/** Vacía toda la papelera — borrado permanente de todo lo que hay en ella (solo admins). */
export const emptyVaultTrash = () => api.delete('/vault/trash');

// ── Carpetas del Vault ──────────────────────────────────────────────────────

/** Lista todas las carpetas del Vault (plana, con parent_id + file_count). */
export const getVaultFolders = () => api.get('/vault/folders');

/**
 * Crea una carpeta nueva. Solo admins.
 * @param {{name: string, parent_id?: number|null}} data
 */
export const createVaultFolder = (data) => api.post('/vault/folders', data);

/**
 * Renombra y/o mueve una carpeta. Solo admins.
 * `move_to_root: true` es la única forma de poner parent_id=null.
 * @param {number} id
 * @param {{name?: string, parent_id?: number, move_to_root?: boolean}} data
 */
export const updateVaultFolder = (id, data) => api.put(`/vault/folders/${id}`, data);

/** Elimina una carpeta (sus archivos suben a la raíz; subcarpetas se borran en cascada). Solo admins. */
export const deleteVaultFolder = (id) => api.delete(`/vault/folders/${id}`);

// ============================================================================
// Filament Profiles — parámetros de slicer por filamento (referencia)
// ============================================================================

/**
 * Obtiene el perfil de slicer de un filamento. 404 si no tiene uno guardado
 * — el caller debe capturar el error y tratarlo como "sin perfil todavía".
 * @param {number} inventoryItemId
 */
export const getFilamentProfile = (inventoryItemId) =>
  api.get(`/filament-profiles/${inventoryItemId}`);

/**
 * Crea o actualiza (upsert) el perfil de slicer de un filamento.
 * @param {number} inventoryItemId
 * @param {Object} data - Campos de FilamentProfileUpsert
 */
export const upsertFilamentProfile = (inventoryItemId, data) =>
  api.put(`/filament-profiles/${inventoryItemId}`, data);

/** Elimina el perfil de slicer de un filamento. */
export const deleteFilamentProfile = (inventoryItemId) =>
  api.delete(`/filament-profiles/${inventoryItemId}`);

// ============================================================================
// Proyectos — agrupador de ítems de la cola de impresión
// ============================================================================

/** Lista todos los proyectos con conteo de items de cola por estado. */
export const getProjects = () => api.get('/projects/');

/**
 * Crea un proyecto nuevo.
 * @param {{name: string, client_name?: string, notes?: string}} data
 */
export const createProject = (data) => api.post('/projects/', data);

/** Detalle de un proyecto (con progreso agregado). */
export const getProject = (id) => api.get(`/projects/${id}`);

/** Lista los ítems de cola (cualquier estado) asociados al proyecto. */
export const getProjectItems = (id) => api.get(`/projects/${id}/items`);

/**
 * Edita nombre/cliente/estado/notas de un proyecto.
 * @param {number} id
 * @param {Object} data - Campos de ProjectUpdate
 */
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);

/** Elimina un proyecto (los items de cola quedan sin agrupar). */
export const deleteProject = (id) => api.delete(`/projects/${id}`);

/**
 * (Re)asigna o quita (projectId=null) el proyecto de un ítem ya encolado.
 * @param {number} itemId
 * @param {number|null} projectId
 */
export const assignQueueItemProject = (itemId, projectId) =>
  api.put(`/queue/${itemId}/project`, { project_id: projectId });

export default api;

