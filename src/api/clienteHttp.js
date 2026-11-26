/*
 * clienteHttp.js
 * -----------------------------------------------------------------------------
 * Responsabilidad UNICA: transportar peticiones HTTP hacia los microservicios
 * y adjuntar el token JWT que entrega Microsoft Entra External ID.
 *
 * Aqui NO hay reglas de negocio ni conocimiento de RabbitMQ ni de Kafka. Eso
 * vive en los modulos apiPedidos.js / apiProcesos.js / apiRabbitAdmin.js /
 * apiKafka.js. Esta separacion es la misma idea que aplicamos en el backend: la
 * configuracion y el transporte se mantienen separados de la logica del dominio.
 */

import { msalInstance } from '../msalInstance';

// Las URL base de cada microservicio se leen desde el archivo .env de Vite,
// nunca se escriben "a mano" dentro de los componentes.
export const BASES = {
  productos: import.meta.env.VITE_MS_PRODUCTOS,
  pedidos: import.meta.env.VITE_MS_PEDIDOS,
  notificaciones: import.meta.env.VITE_MS_NOTIFICACIONES,
  adminRabbit: import.meta.env.VITE_MS_ADMIN_RABBIT,
  kafka: import.meta.env.VITE_MS_KAFKA,
};

/*
 * Scopes de la API protegida. El backend exige 'Productos.Read' para las
 * lecturas y 'Productos.Write' para las escrituras, por lo que el token debe
 * pedirse con ambos. Se declaran en el .env separados por coma.
 */
export const SCOPES_API = (import.meta.env.VITE_API_SCOPES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Error enriquecido: conserva el status HTTP y el cuerpo que devolvio el
 * backend. Lo usamos para poder mostrar en pantalla los detalles de validacion
 * (campo por campo) que entrega el ManejadorDeErrores del microservicio.
 */
export class ErrorHttp extends Error {
  constructor(mensaje, status, cuerpo) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.status = status;
    this.cuerpo = cuerpo;
  }
}

/**
 * Token de la sesion en curso, obtenido en silencio desde la cache de MSAL.
 *
 * Sirve de respaldo para los modulos que no reciben el token por parametro.
 * Varios endpoints del backend son publicos y en desarrollo se alcanzan sin
 * credenciales, pero cuando el sistema queda detras del API Manager la puerta
 * de enlace exige el token en todas sus rutas y rechaza la peticion antes de
 * que llegue al microservicio. Adjuntarlo siempre que haya sesion deja un
 * unico comportamiento para los dos entornos.
 *
 * Si no hay sesion o la cache no alcanza, devuelve null y la peticion sale sin
 * cabecera: asi los endpoints publicos siguen funcionando sin haber iniciado
 * sesion, que es como se usan en local.
 */
async function tokenDeSesion() {
  try {
    const cuenta =
      msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
    if (!cuenta) return null;
    const resultado = await msalInstance.acquireTokenSilent({
      account: cuenta,
      scopes: SCOPES_API,
    });
    return resultado.accessToken;
  } catch (error) {
    // Sin token se continua igual; el servidor decidira si acepta o rechaza.
    return null;
  }
}

/**
 * Realiza una peticion HTTP contra un microservicio.
 *
 * @param {string} base     URL base del microservicio (ver BASES)
 * @param {string} ruta     Ruta relativa, por ejemplo '/api/pedidos'
 * @param {object} opciones { metodo, cuerpo, token }
 */
export async function peticion(base, ruta, opciones = {}) {
  const { metodo = 'GET', cuerpo = null, token = null } = opciones;

  const cabeceras = { Accept: 'application/json' };
  if (cuerpo !== null) cabeceras['Content-Type'] = 'application/json';
  // El que viene por parametro manda; si no hay, se usa el de la sesion.
  const credencial = token ?? (await tokenDeSesion());
  if (credencial) cabeceras['Authorization'] = `Bearer ${credencial}`;

  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo !== null ? JSON.stringify(cuerpo) : undefined,
  });

  // Leemos el cuerpo como texto y luego intentamos interpretarlo como JSON,
  // porque algunos errores (por ejemplo un 401 del filtro de seguridad)
  // llegan vacios o en texto plano.
  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch (e) {
      datos = { mensaje: texto };
    }
  }

  if (!respuesta.ok) {
    const descripcion =
      (datos && (datos.mensaje || datos.error || datos.message)) ||
      `HTTP ${respuesta.status}`;
    throw new ErrorHttp(descripcion, respuesta.status, datos);
  }

  return datos;
}
