/*
 * apiPedidos.js
 * -----------------------------------------------------------------------------
 * Operaciones contra ms-pedidos (puerto 8082), el microservicio PRODUCTOR.
 *
 * Cuando aqui se crea un pedido, el backend lo guarda en base de datos y
 * publica UN evento 'pedido.creado' en el exchange de tipo topic. RabbitMQ se
 * encarga de copiarlo a las tres colas de dominio (notificaciones, documentos,
 * inventario). El frontend nunca habla con RabbitMQ: solo habla HTTP.
 */
import { BASES, peticion } from './clienteHttp';

// Valores permitidos para el campo 'simulacion' del pedido. Sirven para forzar
// a proposito los distintos caminos de error y ejercitar reintento y DLQ.
export const SIMULACIONES = {
  NINGUNA: 'NINGUNA',
  ERROR_RECUPERABLE: 'ERROR_RECUPERABLE',
  ERROR_NO_RECUPERABLE: 'ERROR_NO_RECUPERABLE',
};

/** Verifica que ms-pedidos este arriba (endpoint publico, sin token). */
export function saludPedidos() {
  return peticion(BASES.pedidos, '/api/health');
}

/** Crea un pedido y dispara la publicacion del evento. */
export function crearPedido(token, pedido) {
  return peticion(BASES.pedidos, '/api/pedidos', {
    metodo: 'POST',
    cuerpo: pedido,
    token,
  });
}

/** Lista los pedidos ya registrados. */
export function listarPedidos(token) {
  return peticion(BASES.pedidos, '/api/pedidos', { token });
}
