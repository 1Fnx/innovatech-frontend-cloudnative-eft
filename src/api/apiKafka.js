/*
 * apiKafka.js
 * -----------------------------------------------------------------------------
 * Operaciones contra ms-kafka (puerto 8888).
 *
 * El modulo cubre dos grupos de operaciones:
 *
 *   /api/kafka        laboratorio de productor y consumidor: publicar, ver lo
 *                     consumido, describir el topic y el grupo
 *   /api/kafka/admin  administracion del cluster: brokers, crear, modificar y
 *                     eliminar topics, y grupos consumidores con su retraso
 *
 * El frontend solo habla HTTP. El recorrido completo de un mensaje es:
 *
 *   React  --HTTP-->  Spring Boot  --protocolo Kafka-->  broker (9092)
 *
 * El navegador nunca abre una conexion contra el puerto 9092: no sabria hablar
 * el protocolo de Kafka y, aunque pudiera, la politica de origenes del propio
 * navegador lo impediria. Toda la mensajeria ocurre del lado del servidor.
 *
 * Estos endpoints son publicos y no exigen token: el laboratorio se centra en
 * particiones y offsets, no en identidad. Por eso aqui no se usa useTokenApi,
 * a diferencia de los modulos que atacan los microservicios del catalogo.
 */
import { BASES, peticion } from './clienteHttp';

/**
 * Comprueba que la aplicacion Spring Boot responda.
 *
 * Importante: este endpoint no consulta al broker. Que responda significa que
 * el microservicio esta arriba, no que Kafka este disponible. Para eso sirve
 * describirTopic().
 */
export function saludKafka() {
  return peticion(BASES.kafka, '/api/kafka/health');
}

/**
 * Publica un registro en el topic.
 *
 * Se usa POST porque la llamada produce un efecto: escribe un registro en el
 * log del broker. La respuesta trae la particion y el offset que asigno Kafka.
 *
 * @param {string} message contenido del registro
 * @param {string} [key]   clave opcional; si se omite, el particionador decide
 *                         sin considerar ninguna clave
 */
export function publicarMensaje(message, key) {
  const parametros = new URLSearchParams({ message });
  if (key) parametros.set('key', key);
  return peticion(BASES.kafka, `/api/kafka/send?${parametros.toString()}`, {
    metodo: 'POST',
  });
}

/**
 * Publica varios registros uno tras otro, esperando la confirmacion de cada
 * uno antes de enviar el siguiente.
 *
 * El envio secuencial es intencional: si se lanzaran en paralelo no se podria
 * afirmar en que orden los recibio el broker, y la prueba de afinidad de clave
 * perderia sentido.
 *
 * @param {Array<{message: string, key?: string}>} mensajes
 */
export async function publicarSecuencia(mensajes) {
  const resultados = [];
  for (const item of mensajes) {
    resultados.push(await publicarMensaje(item.message, item.key));
  }
  return resultados;
}

/** Registros que alcanzo a leer el consumidor, del mas reciente al mas antiguo. */
export function listarRecibidos() {
  return peticion(BASES.kafka, '/api/kafka/recibidos');
}

/** Vacia la vista en memoria. No borra nada en Kafka ni mueve offsets. */
export function limpiarRecibidos() {
  return peticion(BASES.kafka, '/api/kafka/recibidos/limpiar', { metodo: 'POST' });
}

/**
 * Descripcion del topic: particiones, replicas y avance del log de cada una.
 * Equivale a la salida de kafka-topics.sh --describe.
 *
 * @param {string} [topic] si se omite, se describe el topic del laboratorio
 */
export function describirTopic(topic) {
  const ruta = topic
    ? `/api/kafka/topico?topic=${encodeURIComponent(topic)}`
    : '/api/kafka/topico';
  return peticion(BASES.kafka, ruta);
}

/**
 * Avance del grupo consumidor: offset confirmado, final del log y retraso por
 * particion. Equivale a kafka-consumer-groups.sh --describe --group.
 *
 * @param {string} [grupo] grupo a consultar; si se omite, el del laboratorio
 * @param {string} [topic] topic sobre el que se mide el retraso
 */
export function describirGrupo(grupo, topic) {
  const parametros = new URLSearchParams();
  if (grupo) parametros.set('grupo', grupo);
  if (topic) parametros.set('topic', topic);
  const consulta = parametros.toString();
  return peticion(BASES.kafka, `/api/kafka/grupo${consulta ? `?${consulta}` : ''}`);
}

/* Administracion del cluster: /api/kafka/admin
 * Equivalente por HTTP de kafka-topics, kafka-configs y kafka-consumer-groups. */

/** Brokers disponibles y broker coordinador. */
export function estadoCluster() {
  return peticion(BASES.kafka, '/api/kafka/admin/cluster');
}

/**
 * Listado de topics con particiones, replicas, replicas sincronizadas y
 * configuracion explicita.
 *
 * @param {boolean} [incluirInternos] true para ver tambien __consumer_offsets
 */
export function listarTopics(incluirInternos = false) {
  return peticion(
    BASES.kafka,
    `/api/kafka/admin/topics?incluirInternos=${incluirInternos}`
  );
}

/** Ficha de un topic concreto. */
export function detalleTopic(nombre) {
  return peticion(BASES.kafka, `/api/kafka/admin/topics/${encodeURIComponent(nombre)}`);
}

/**
 * Crea un topic.
 *
 * @param {{nombre: string, particiones?: number, replicas?: number,
 *          retencionMs?: number, crearDlt?: boolean}} datos
 */
export function crearTopic(datos) {
  return peticion(BASES.kafka, '/api/kafka/admin/topics', {
    metodo: 'POST',
    cuerpo: {
      nombre: datos.nombre,
      particiones: datos.particiones ?? null,
      replicas: datos.replicas ?? null,
      retencionMs: datos.retencionMs ?? null,
      crearDlt: Boolean(datos.crearDlt),
    },
  });
}

/** Solo hacia arriba: Kafka no permite reducir particiones. */
export function ampliarParticiones(nombre, particiones) {
  return peticion(
    BASES.kafka,
    `/api/kafka/admin/topics/${encodeURIComponent(nombre)}/particiones`,
    { metodo: 'PATCH', cuerpo: { particiones: Number(particiones) } }
  );
}

/**
 * Modifica parametros de configuracion del topic.
 *
 * @param {string} nombre
 * @param {Object<string, string>} configuracion por ejemplo
 *        { 'retention.ms': '3600000', 'cleanup.policy': 'delete' }
 */
export function configurarTopic(nombre, configuracion) {
  return peticion(
    BASES.kafka,
    `/api/kafka/admin/topics/${encodeURIComponent(nombre)}/configuracion`,
    { metodo: 'PATCH', cuerpo: { configuracion } }
  );
}

/** Los topicos del flujo de pedidos exigen confirmar=true. */
export function eliminarTopic(nombre, confirmar = false) {
  return peticion(
    BASES.kafka,
    `/api/kafka/admin/topics/${encodeURIComponent(nombre)}?confirmar=${confirmar}`,
    { metodo: 'DELETE' }
  );
}

/** Grupos consumidores con su estado, sus miembros y su retraso total. */
export function listarGrupos() {
  return peticion(BASES.kafka, '/api/kafka/admin/grupos');
}

/* Topologia del negocio. Se declara aqui para que la pantalla no escriba los
 * nombres sueltos en el JSX. */

export const TOPIC_PEDIDOS = 'innovatech.pedidos.eventos';
export const TOPIC_MOVIMIENTOS = 'innovatech.inventario.movimientos';
export const SUFIJO_DLT = '.DLT';

/** Las dos etapas del pipeline, en el orden en que ocurren. */
export const ETAPAS_PIPELINE = [
  {
    topic: TOPIC_PEDIDOS,
    produce: 'ms-pedidos',
    consume: 'ms-productos (grupo-inventario) y ms-notificaciones (grupo-notificaciones)',
    descripcion:
      'Un pedido creado se publica como hecho. Dos microservicios distintos lo ' +
      'leen con grupos distintos, por lo que ambos reciben todos los eventos.',
  },
  {
    topic: TOPIC_MOVIMIENTOS,
    produce: 'ms-productos',
    consume: 'ms-notificaciones (grupo-alertas)',
    descripcion:
      'Tras descontar stock, ms-productos publica el movimiento resultante. ' +
      'La deteccion de stock bajo reacciona sola, sin que nadie se lo pida.',
  },
];

/** Grupos consumidores propios del pipeline. */
export const GRUPOS_DEL_NEGOCIO = [
  { grupo: 'grupo-inventario', topic: TOPIC_PEDIDOS, servicio: 'ms-productos' },
  { grupo: 'grupo-notificaciones', topic: TOPIC_PEDIDOS, servicio: 'ms-notificaciones' },
  { grupo: 'grupo-alertas', topic: TOPIC_MOVIMIENTOS, servicio: 'ms-notificaciones' },
];

/** Mensajes de la Prueba A: tres registros sin clave. */
export const PRUEBA_SIN_CLAVE = [
  { message: 'Mensaje1' },
  { message: 'Mensaje2' },
  { message: 'Mensaje3' },
];

/**
 * Mensajes de la Prueba B: los tres estados de una misma orden, publicados
 * con la misma clave para que queden en la misma particion y en orden.
 */
export const CLAVE_DE_PRUEBA = 'orden-555';

export const PRUEBA_CON_CLAVE = [
  { message: 'Paso1-Creada', key: CLAVE_DE_PRUEBA },
  { message: 'Paso2-Pagada', key: CLAVE_DE_PRUEBA },
  { message: 'Paso3-Enviada', key: CLAVE_DE_PRUEBA },
];
