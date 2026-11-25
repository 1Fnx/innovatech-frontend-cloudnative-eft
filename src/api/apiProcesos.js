/*
 * apiProcesos.js
 * -----------------------------------------------------------------------------
 * Operaciones contra los microservicios CONSUMIDORES.
 *
 * ms-notificaciones (8083) expone /api/procesos: la bitacora de todo lo que
 * los @RabbitListener alcanzaron a procesar, con el resultado OK / REINTENTO /
 * DLQ. Permite confirmar que el trabajo asincrono ocurrio despues de que el
 * POST del pedido ya le habia respondido al cliente.
 *
 * ms-productos (8081) expone el stock, que el listener de inventario descuenta
 * al consumir el evento.
 */
import { BASES, peticion } from './clienteHttp';

/** Bitacora de mensajes consumidos (ms-notificaciones). */
export function listarProcesos(token) {
  return peticion(BASES.notificaciones, '/api/procesos', { token });
}

/** Salud de ms-notificaciones (publico). */
export function saludNotificaciones() {
  return peticion(BASES.notificaciones, '/api/health');
}

/** Catalogo con el stock actual (ms-productos). */
export function listarProductos(token) {
  return peticion(BASES.productos, '/api/productos', { token });
}

/** Salud de ms-productos (publico). */
export function saludProductos() {
  return peticion(BASES.productos, '/api/health');
}
