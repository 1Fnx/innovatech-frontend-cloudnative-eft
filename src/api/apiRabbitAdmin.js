/*
 * apiRabbitAdmin.js
 * -----------------------------------------------------------------------------
 * Operaciones contra ms-admin-rabbit (puerto 8084).
 *
 * Este microservicio expone por REST la administracion de la topologia de
 * RabbitMQ: crear y eliminar colas, exchanges y bindings, purgar una cola y
 * consultar su estado. Internamente usa RabbitAdmin de Spring AMQP.
 *
 * Las operaciones destructivas (DELETE y purge) estan restringidas al rol
 * Admin en el backend, por lo que un usuario Vendedor recibira 403.
 */
import { BASES, peticion } from './clienteHttp';

/** Salud del microservicio de administracion (publico). */
export function saludAdmin() {
  return peticion(BASES.adminRabbit, '/api/health');
}

/** Devuelve la topologia declarada por configuracion (nombres logicos). */
export function obtenerTopologia(token) {
  return peticion(BASES.adminRabbit, '/api/rabbit/topologia', { token });
}

/* ---------------------------- COLAS ---------------------------- */

export function crearCola(token, solicitud) {
  return peticion(BASES.adminRabbit, '/api/rabbit/queues', {
    metodo: 'POST',
    cuerpo: solicitud,
    token,
  });
}

export function consultarCola(token, nombre) {
  return peticion(
    BASES.adminRabbit,
    `/api/rabbit/queues/${encodeURIComponent(nombre)}`,
    { token }
  );
}

export function eliminarCola(token, nombre) {
  return peticion(
    BASES.adminRabbit,
    `/api/rabbit/queues/${encodeURIComponent(nombre)}`,
    { metodo: 'DELETE', token }
  );
}

export function purgarCola(token, nombre) {
  return peticion(
    BASES.adminRabbit,
    `/api/rabbit/queues/${encodeURIComponent(nombre)}/purge`,
    { metodo: 'POST', token }
  );
}

/* -------------------------- EXCHANGES -------------------------- */

export function crearExchange(token, solicitud) {
  return peticion(BASES.adminRabbit, '/api/rabbit/exchanges', {
    metodo: 'POST',
    cuerpo: solicitud,
    token,
  });
}

export function eliminarExchange(token, nombre) {
  return peticion(
    BASES.adminRabbit,
    `/api/rabbit/exchanges/${encodeURIComponent(nombre)}`,
    { metodo: 'DELETE', token }
  );
}

/* --------------------------- BINDINGS -------------------------- */

export function crearBinding(token, solicitud) {
  return peticion(BASES.adminRabbit, '/api/rabbit/bindings', {
    metodo: 'POST',
    cuerpo: solicitud,
    token,
  });
}

export function eliminarBinding(token, solicitud) {
  return peticion(BASES.adminRabbit, '/api/rabbit/bindings', {
    metodo: 'DELETE',
    cuerpo: solicitud,
    token,
  });
}
