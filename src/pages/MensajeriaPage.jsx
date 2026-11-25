/*
 * MensajeriaPage.jsx
 * -----------------------------------------------------------------------------
 * Pantalla de mensajeria.
 *
 * Reune las operaciones que ejercitan el flujo asincrono de extremo a extremo:
 *  1. El frontend crea un pedido con un POST normal y recibe respuesta de
 *     inmediato (procesamiento asincrono: el usuario no espera a que se envien
 *     correos, se generen documentos ni se descuente stock).
 *  2. Ese unico POST provoca dos cosas a la vez. Por un lado RabbitMQ entrega
 *     el evento a TRES colas de dominio distintas, cada una con su propio
 *     consumidor. Por otro, el mismo evento se publica en el topic de Kafka
 *     innovatech.pedidos.eventos, donde lo leen dos grupos consumidores
 *     distintos, y uno de ellos encadena una segunda etapa publicando el
 *     movimiento de inventario en otro topic.
 *  3. Con el selector de simulacion se puede forzar un error recuperable
 *     (se reintenta una vez y luego va a la DLQ) o un error no recuperable
 *     (va directo a la DLQ, sin reintentos).
 *  4. La bitacora y el stock permiten comprobar a posteriori que el trabajo
 *     asincrono efectivamente se ejecuto.
 */
import { useCallback, useState } from 'react';
import { useTokenApi } from '../hooks/useTokenApi';
import { crearPedido, listarPedidos, SIMULACIONES } from '../api/apiPedidos';
import { listarProcesos, listarProductos } from '../api/apiProcesos';
import PanelJson from '../components/PanelJson';
import MensajeAlerta from '../components/MensajeAlerta';
import TarjetaSalud from '../components/TarjetaSalud';
import '../estilos/rabbitmq-ui.css';

// Pedido base que se envia. Los ids y nombres coinciden con los productos que
// ms-productos carga al arrancar, para que el descuento de stock sea visible.
const PEDIDO_BASE = {
  cliente: 'Ignacio San Martin',
  email: 'ig.sanmartinn@duocuc.cl',
  items: [
    { productoId: 1, nombre: 'Alimento Premium Adulto 15kg', cantidad: 2, precio: 42990 },
    { productoId: 2, nombre: 'Alimento Cachorro 10kg', cantidad: 1, precio: 31990 },
  ],
};

export default function MensajeriaPage() {
  const { obtenerToken, cuenta } = useTokenApi();

  const [simulacion, setSimulacion] = useState(SIMULACIONES.NINGUNA);
  const [cliente, setCliente] = useState(PEDIDO_BASE.cliente);
  const [email, setEmail] = useState(PEDIDO_BASE.email);

  const [respuestaPedido, setRespuestaPedido] = useState(null);
  const [pedidos, setPedidos] = useState(null);
  const [procesos, setProcesos] = useState(null);
  const [productos, setProductos] = useState(null);

  const [alerta, setAlerta] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  /** Envuelve cualquier llamada para centralizar el manejo de errores. */
  const ejecutar = useCallback(async (accion) => {
    setTrabajando(true);
    setAlerta(null);
    try {
      await accion();
    } catch (error) {
      setAlerta({
        tipo: 'error',
        texto: `${error.status ? `HTTP ${error.status} - ` : ''}${error.message}`,
        detalles: error.cuerpo?.detalles,
      });
    } finally {
      setTrabajando(false);
    }
  }, []);

  const publicar = () =>
    ejecutar(async () => {
      const token = await obtenerToken();
      const cuerpo = { ...PEDIDO_BASE, cliente, email, simulacion };
      const inicio = performance.now();
      const datos = await crearPedido(token, cuerpo);
      const ms = Math.round(performance.now() - inicio);
      setRespuestaPedido({ ...datos, _msRespuestaHttp: ms });
      setAlerta({
        tipo: 'ok',
        texto:
          `Pedido creado y evento publicado en ${ms} ms. ` +
          'RabbitMQ ya esta repartiendo el mensaje a las tres colas de dominio.',
      });
    });

  const verPedidos = () =>
    ejecutar(async () => {
      const token = await obtenerToken();
      setPedidos(await listarPedidos(token));
    });

  const verProcesos = () =>
    ejecutar(async () => {
      const token = await obtenerToken();
      setProcesos(await listarProcesos(token));
    });

  const verProductos = () =>
    ejecutar(async () => {
      const token = await obtenerToken();
      setProductos(await listarProductos(token));
    });

  return (
    <div className="rmq-pagina">
      <h2>Mensajería asíncrona: colas con RabbitMQ y streaming con Kafka</h2>
      <p className="rmq-intro">
        Al crear un pedido, <strong>ms-pedidos</strong> lo guarda y anuncia el
        hecho por los dos canales a la vez, cada uno resolviendo un problema
        distinto.
      </p>
      <p className="rmq-intro">
        Por <strong>RabbitMQ</strong> publica un único evento{' '}
        <code>pedido.creado</code> en el exchange de tipo <em>topic</em>, y el
        broker lo copia a las colas de notificaciones, documentos e inventario.
        Ahí el mensaje es un <em>trabajo</em>: alguien debe ejecutarlo una vez y
        al confirmarlo desaparece de la cola.
      </p>
      <p className="rmq-intro">
        Por <strong>Kafka</strong> publica el mismo evento en el topic{' '}
        <code>innovatech.pedidos.eventos</code>, con el identificador del pedido
        como clave. Ahí el mensaje es un <em>hecho</em>: queda escrito en el log
        y lo leen dos grupos consumidores distintos, de modo que ambos reciben
        todos los eventos. Uno de ellos, el de inventario, encadena una segunda
        etapa publicando el movimiento en{' '}
        <code>innovatech.inventario.movimientos</code>, donde un tercer grupo
        detecta el stock bajo sin que nadie se lo pida. El recorrido completo se
        observa en la pantalla <strong>Admin Kafka</strong>.
      </p>

      <TarjetaSalud />

      <section className="rmq-tarjeta">
        <header className="rmq-tarjeta-cabecera">
          <h3>1. Publicar un pedido</h3>
          <span className="rmq-usuario">
            {cuenta ? `Sesion: ${cuenta.username}` : 'Sin sesion'}
          </span>
        </header>

        <div className="rmq-formulario">
          <label>
            Cliente
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </label>
          <label>
            Correo
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Escenario a simular
            <select
              value={simulacion}
              onChange={(e) => setSimulacion(e.target.value)}
            >
              <option value={SIMULACIONES.NINGUNA}>
                NINGUNA - procesamiento correcto
              </option>
              <option value={SIMULACIONES.ERROR_RECUPERABLE}>
                ERROR_RECUPERABLE - reintenta 1 vez y luego va a la DLQ
              </option>
              <option value={SIMULACIONES.ERROR_NO_RECUPERABLE}>
                ERROR_NO_RECUPERABLE - va directo a la DLQ
              </option>
            </select>
          </label>
        </div>

        <div className="rmq-acciones">
          <button type="button" onClick={publicar} disabled={trabajando}>
            Crear pedido y publicar evento
          </button>
        </div>

        <MensajeAlerta {...(alerta ?? {})} />
        <PanelJson titulo="Respuesta de ms-pedidos (POST /api/pedidos)" datos={respuestaPedido} />
      </section>

      <section className="rmq-tarjeta">
        <h3>2. Comprobar que el trabajo asincrono ocurrio</h3>
        <p className="rmq-ayuda">
          Estas tres consultas se hacen <strong>después</strong> de que el POST
          ya respondió. Si muestran datos nuevos, significa que los consumidores
          procesaron el mensaje por su cuenta: los <code>@RabbitListener</code>{' '}
          desde las colas y los <code>@KafkaListener</code> desde los topics. La
          bitácora distingue el origen de cada fila en su columna de dominio.
        </p>
        <div className="rmq-acciones">
          <button type="button" onClick={verProcesos} disabled={trabajando}>
            Bitacora de mensajes consumidos
          </button>
          <button type="button" onClick={verProductos} disabled={trabajando}>
            Stock actual (descontado por el listener de inventario)
          </button>
          <button type="button" onClick={verPedidos} disabled={trabajando}>
            Pedidos registrados
          </button>
        </div>

        {Array.isArray(procesos) && (
          <table className="rmq-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Dominio</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Resultado</th>
                <th>Detalle</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {procesos.map((p) => (
                <tr key={p.id} className={`rmq-fila-${(p.resultado || '').toLowerCase()}`}>
                  <td>{p.id}</td>
                  <td>{p.dominio}</td>
                  <td>{p.pedidoId}</td>
                  <td>{p.cliente}</td>
                  <td><strong>{p.resultado}</strong></td>
                  <td>{p.detalle}</td>
                  <td>{p.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <PanelJson titulo="Stock (GET /api/productos)" datos={productos} />
        <PanelJson titulo="Pedidos (GET /api/pedidos)" datos={pedidos} />
      </section>
    </div>
  );
}
