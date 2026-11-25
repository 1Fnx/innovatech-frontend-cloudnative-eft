/*
 * AdminRabbitPage.jsx
 * -----------------------------------------------------------------------------
 * Pantalla de administracion de RabbitMQ.
 *
 * Permite administrar la topologia de RabbitMQ desde la propia aplicacion,
 * llamando al microservicio ms-admin-rabbit, que internamente usa RabbitAdmin
 * de Spring AMQP. Desde aqui se puede:
 *   - crear una cola, opcionalmente con DLX, TTL y largo maximo
 *   - consultar cuantos mensajes y consumidores tiene una cola
 *   - purgar y eliminar colas (solo rol Admin)
 *   - crear y eliminar exchanges de cualquier tipo
 *   - crear y eliminar bindings entre un exchange y una cola
 *
 * Las operaciones destructivas estan protegidas en el backend con
 * @PreAuthorize("hasRole('Admin')"): si entra un usuario Vendedor, el backend
 * responde 403 y esta pantalla lo muestra tal cual.
 */
import { useCallback, useState } from 'react';
import { useTokenApi } from '../hooks/useTokenApi';
import {
  consultarCola,
  crearBinding,
  crearCola,
  crearExchange,
  eliminarBinding,
  eliminarCola,
  eliminarExchange,
  obtenerTopologia,
  purgarCola,
} from '../api/apiRabbitAdmin';
import PanelJson from '../components/PanelJson';
import MensajeAlerta from '../components/MensajeAlerta';
import '../estilos/rabbitmq-ui.css';

export default function AdminRabbitPage() {
  const { obtenerToken, cuenta } = useTokenApi();

  // --- formulario de cola ---
  const [cola, setCola] = useState({
    nombre: 'demo.pruebas.queue',
    durable: true,
    autoDelete: false,
    deadLetterExchange: 'innovatech.dlx',
    deadLetterRoutingKey: 'dlq.demo',
    mensajeTtlMs: '',
    longitudMaxima: '',
  });

  // --- formulario de exchange ---
  const [exchange, setExchange] = useState({
    nombre: 'demo.pruebas.exchange',
    tipo: 'topic',
    durable: true,
    autoDelete: false,
  });

  // --- formulario de binding ---
  const [binding, setBinding] = useState({
    cola: 'demo.pruebas.queue',
    exchange: 'demo.pruebas.exchange',
    routingKey: 'demo.#',
  });

  const [nombreConsulta, setNombreConsulta] = useState('pedidos.notificaciones.queue');

  const [resultado, setResultado] = useState(null);
  const [tituloResultado, setTituloResultado] = useState('');
  const [alerta, setAlerta] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  /** Centraliza el manejo de errores y de estado de carga. */
  const ejecutar = useCallback(
    async (titulo, accion, textoExito) => {
      setTrabajando(true);
      setAlerta(null);
      try {
        const token = await obtenerToken();
        const datos = await accion(token);
        setTituloResultado(titulo);
        setResultado(datos ?? { resultado: 'operacion ejecutada sin contenido' });
        setAlerta({ tipo: 'ok', texto: textoExito });
      } catch (error) {
        setTituloResultado(titulo);
        setResultado(error.cuerpo ?? { mensaje: error.message });
        // El 403 merece un aviso distinto: no es un fallo tecnico sino la
        // autorizacion por rol funcionando como corresponde.
        const texto =
          error.status === 403
            ? 'HTTP 403 - La cuenta actual no tiene el rol Admin, por lo que el backend rechazo la operacion destructiva.'
            : `${error.status ? `HTTP ${error.status} - ` : ''}${error.message}`;
        setAlerta({ tipo: 'error', texto, detalles: error.cuerpo?.detalles });
      } finally {
        setTrabajando(false);
      }
    },
    [obtenerToken]
  );

  /** Convierte los campos opcionales vacios en null antes de enviarlos. */
  const construirSolicitudCola = () => ({
    nombre: cola.nombre,
    durable: cola.durable,
    autoDelete: cola.autoDelete,
    deadLetterExchange: cola.deadLetterExchange || null,
    deadLetterRoutingKey: cola.deadLetterRoutingKey || null,
    mensajeTtlMs: cola.mensajeTtlMs === '' ? null : Number(cola.mensajeTtlMs),
    longitudMaxima: cola.longitudMaxima === '' ? null : Number(cola.longitudMaxima),
  });

  return (
    <div className="rmq-pagina">
      <h2>Administracion de RabbitMQ desde la aplicacion</h2>
      <p className="rmq-intro">
        Esta pantalla no habla con RabbitMQ directamente. Llama por REST al
        microservicio <strong>ms-admin-rabbit</strong>, que es el unico que usa
        <code> RabbitAdmin</code>. Asi la administracion queda centralizada,
        validada y protegida por roles.
      </p>

      <div className="rmq-acciones">
        <button
          type="button"
          disabled={trabajando}
          onClick={() =>
            ejecutar(
              'GET /api/rabbit/topologia',
              (t) => obtenerTopologia(t),
              'Topologia leida desde la configuracion centralizada.'
            )
          }
        >
          Ver topologia configurada
        </button>
        <span className="rmq-usuario">
          {cuenta ? `Sesion: ${cuenta.username}` : 'Sin sesion'}
        </span>
      </div>

      {/* ------------------------------ COLAS ------------------------------ */}
      <section className="rmq-tarjeta">
        <h3>Colas</h3>
        <div className="rmq-formulario">
          <label>
            Nombre de la cola
            <input
              value={cola.nombre}
              onChange={(e) => setCola({ ...cola, nombre: e.target.value })}
            />
          </label>
          <label>
            Dead Letter Exchange (opcional)
            <input
              value={cola.deadLetterExchange}
              onChange={(e) => setCola({ ...cola, deadLetterExchange: e.target.value })}
            />
          </label>
          <label>
            Dead Letter Routing Key (opcional)
            <input
              value={cola.deadLetterRoutingKey}
              onChange={(e) => setCola({ ...cola, deadLetterRoutingKey: e.target.value })}
            />
          </label>
          <label>
            TTL del mensaje en ms (opcional)
            <input
              type="number"
              value={cola.mensajeTtlMs}
              onChange={(e) => setCola({ ...cola, mensajeTtlMs: e.target.value })}
            />
          </label>
          <label>
            Largo maximo de la cola (opcional)
            <input
              type="number"
              value={cola.longitudMaxima}
              onChange={(e) => setCola({ ...cola, longitudMaxima: e.target.value })}
            />
          </label>
          <label className="rmq-check">
            <input
              type="checkbox"
              checked={cola.durable}
              onChange={(e) => setCola({ ...cola, durable: e.target.checked })}
            />
            Durable (sobrevive al reinicio del broker)
          </label>
          <label className="rmq-check">
            <input
              type="checkbox"
              checked={cola.autoDelete}
              onChange={(e) => setCola({ ...cola, autoDelete: e.target.checked })}
            />
            Auto delete (se borra al quedar sin consumidores)
          </label>
        </div>

        <div className="rmq-acciones">
          <button
            type="button"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                'POST /api/rabbit/queues',
                (t) => crearCola(t, construirSolicitudCola()),
                `Cola ${cola.nombre} declarada en el broker.`
              )
            }
          >
            Crear cola
          </button>
          <button
            type="button"
            className="rmq-peligro"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                `POST /api/rabbit/queues/${cola.nombre}/purge`,
                (t) => purgarCola(t, cola.nombre),
                `Cola ${cola.nombre} purgada.`
              )
            }
          >
            Purgar cola (rol Admin)
          </button>
          <button
            type="button"
            className="rmq-peligro"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                `DELETE /api/rabbit/queues/${cola.nombre}`,
                (t) => eliminarCola(t, cola.nombre),
                `Cola ${cola.nombre} eliminada.`
              )
            }
          >
            Eliminar cola (rol Admin)
          </button>
        </div>

        <div className="rmq-formulario">
          <label>
            Consultar estado de una cola
            <input
              value={nombreConsulta}
              onChange={(e) => setNombreConsulta(e.target.value)}
            />
          </label>
        </div>
        <div className="rmq-acciones">
          <button
            type="button"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                `GET /api/rabbit/queues/${nombreConsulta}`,
                (t) => consultarCola(t, nombreConsulta),
                'Estado de la cola consultado.'
              )
            }
          >
            Consultar mensajes y consumidores
          </button>
        </div>
      </section>

      {/* ---------------------------- EXCHANGES ---------------------------- */}
      <section className="rmq-tarjeta">
        <h3>Exchanges</h3>
        <div className="rmq-formulario">
          <label>
            Nombre del exchange
            <input
              value={exchange.nombre}
              onChange={(e) => setExchange({ ...exchange, nombre: e.target.value })}
            />
          </label>
          <label>
            Tipo
            <select
              value={exchange.tipo}
              onChange={(e) => setExchange({ ...exchange, tipo: e.target.value })}
            >
              <option value="direct">direct - routing key exacta</option>
              <option value="topic">topic - routing key con patrones</option>
              <option value="fanout">fanout - copia a todas las colas</option>
              <option value="headers">headers - decide por cabeceras</option>
            </select>
          </label>
          <label className="rmq-check">
            <input
              type="checkbox"
              checked={exchange.durable}
              onChange={(e) => setExchange({ ...exchange, durable: e.target.checked })}
            />
            Durable
          </label>
          <label className="rmq-check">
            <input
              type="checkbox"
              checked={exchange.autoDelete}
              onChange={(e) => setExchange({ ...exchange, autoDelete: e.target.checked })}
            />
            Auto delete
          </label>
        </div>
        <div className="rmq-acciones">
          <button
            type="button"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                'POST /api/rabbit/exchanges',
                (t) => crearExchange(t, exchange),
                `Exchange ${exchange.nombre} de tipo ${exchange.tipo} declarado.`
              )
            }
          >
            Crear exchange
          </button>
          <button
            type="button"
            className="rmq-peligro"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                `DELETE /api/rabbit/exchanges/${exchange.nombre}`,
                (t) => eliminarExchange(t, exchange.nombre),
                `Exchange ${exchange.nombre} eliminado.`
              )
            }
          >
            Eliminar exchange (rol Admin)
          </button>
        </div>
      </section>

      {/* ----------------------------- BINDINGS ---------------------------- */}
      <section className="rmq-tarjeta">
        <h3>Bindings</h3>
        <p className="rmq-ayuda">
          El binding es la regla que une un exchange con una cola. Sin binding,
          el exchange recibe el mensaje y lo descarta porque no sabe a donde
          enviarlo.
        </p>
        <div className="rmq-formulario">
          <label>
            Exchange de origen
            <input
              value={binding.exchange}
              onChange={(e) => setBinding({ ...binding, exchange: e.target.value })}
            />
          </label>
          <label>
            Cola de destino
            <input
              value={binding.cola}
              onChange={(e) => setBinding({ ...binding, cola: e.target.value })}
            />
          </label>
          <label>
            Routing key
            <input
              value={binding.routingKey}
              onChange={(e) => setBinding({ ...binding, routingKey: e.target.value })}
            />
          </label>
        </div>
        <div className="rmq-acciones">
          <button
            type="button"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                'POST /api/rabbit/bindings',
                (t) => crearBinding(t, binding),
                'Binding creado.'
              )
            }
          >
            Crear binding
          </button>
          <button
            type="button"
            className="rmq-peligro"
            disabled={trabajando}
            onClick={() =>
              ejecutar(
                'DELETE /api/rabbit/bindings',
                (t) => eliminarBinding(t, binding),
                'Binding eliminado.'
              )
            }
          >
            Eliminar binding (rol Admin)
          </button>
        </div>
      </section>

      <MensajeAlerta {...(alerta ?? {})} />
      <PanelJson titulo={tituloResultado} datos={resultado} />
    </div>
  );
}
