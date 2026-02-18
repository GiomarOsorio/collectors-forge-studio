/**
 * @file Capa de servicio API para Calculator3D.
 *
 * Configura una instancia de Axios con la URL base del backend,
 * interceptores de solicitud para inyectar el token JWT de autenticacion,
 * e interceptores de respuesta para manejar errores 401 (no autorizado)
 * redirigiendo automaticamente al usuario a la pagina de login.
 *
 * Exporta funciones para todas las operaciones del API:
 * - Autenticacion (login, registro, perfil)
 * - CRUD de filamentos
 * - CRUD de impresoras
 * - Configuracion de la aplicacion
 * - Cotizaciones (calcular, crear, listar, descargar PDF)
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
      window.location.href = '/login';
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
 * Registra un nuevo usuario en el sistema.
 *
 * @param {Object} data - Datos del nuevo usuario
 * @param {string} data.username - Nombre de usuario
 * @param {string} data.password - Contrasena
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con los datos del usuario creado
 */
export const register = (data) => api.post('/auth/register', data);

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
 * @param {number} data.nozzle_price - Precio de la boquilla
 * @param {number} data.nozzle_lifespan_hours - Vida util de la boquilla en horas
 * @param {number} data.buildplate_price - Precio de la placa de construccion
 * @param {number} data.buildplate_lifespan_hours - Vida util de la placa en horas
 * @param {number} data.other_maintenance_per_hour - Otros costos de mantenimiento por hora
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
 * @param {Object} data - Datos de la pieza a cotizar
 * @param {string} data.piece_name - Nombre de la pieza
 * @param {string|null} data.description - Descripcion opcional de la pieza
 * @param {string|null} data.client_name - Nombre del cliente opcional
 * @param {number} data.filament_id - ID del filamento a utilizar
 * @param {number} data.printer_id - ID de la impresora a utilizar
 * @param {number} data.weight_grams - Peso del filamento en gramos
 * @param {number} data.print_time_hours - Tiempo de impresion en horas
 * @param {number} data.preparation_time_hours - Tiempo de preparacion en horas
 * @param {number} data.post_processing_time_hours - Tiempo de post-procesado en horas
 * @param {number} data.quantity - Cantidad de unidades
 * @param {number} data.margin_percent - Porcentaje de margen de ganancia
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el desglose de costos
 */
export const calculateQuote = (data) => api.post('/quotes/calculate', data);

/**
 * Crea y guarda una cotizacion en el historial.
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

/**
 * Descarga el PDF de una cotizacion.
 * Retorna la respuesta como Blob para poder crear un enlace de descarga.
 *
 * @param {number} id - ID de la cotizacion
 * @returns {Promise<import('axios').AxiosResponse>} Respuesta con el archivo PDF como Blob
 */
export const downloadQuotePdf = (id) =>
  api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });

/** Obtiene la tasa de cambio USD → COP actualmente en uso, con markup incluido. */
export const getExchangeRate = () => api.get('/settings/exchange-rate');

export default api;
