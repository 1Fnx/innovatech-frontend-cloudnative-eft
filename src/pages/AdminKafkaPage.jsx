/*
 * Administracion del cluster de Kafka. Contraparte de AdminRabbitPage: alla
 * colas, aqui topicos.
 *
 * Secciones y su equivalente por consola:
 *   cluster         kafka-broker-api-versions
 *   topics          kafka-topics --describe / kafka-configs --describe
 *   crear           kafka-topics --create
 *   particiones     kafka-topics --alter --partitions
 *   configuracion   kafka-configs --alter
 *   eliminar        kafka-topics --delete
 *   grupos          kafka-consumer-groups --describe
 *
 * Los pedidos se crean en la pantalla de Mensajeria; aqui solo se administra
 * la topologia y se comprueba el avance del pipeline.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ETAPAS_PIPELINE,
  GRUPOS_DEL_NEGOCIO,
  SUFIJO_DLT,
  ampliarParticiones,
  configurarTopic,
  crearTopic,
  eliminarTopic,
  estadoCluster,
  listarGrupos,
  listarTopics,
} from '../api/apiKafka';
import PanelJson from '../components/PanelJson';
import MensajeAlerta from '../components/MensajeAlerta';
import '../estilos/kafka-ui.css';

/** Valores iniciales del formulario de creacion. */
const TOPIC_NUEVO = {
  nombre: 'innovatech.pruebas.admin',
  particiones: 3,
  replicas: 3,
  retencionHoras: 168,
  crearDlt: true,
};

export default function AdminKafkaPage() {
  const [cluster, setCluster] = useState(null);
  const [topics, setTopics] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [incluirInternos, setIncluirInternos] = useState(false);

  // Formulario de creacion.
  const [nuevo, setNuevo] = useState(TOPIC_NUEVO);

  // Formulario de modificacion. El topic se elige desde la tabla.
  const [seleccionado, setSeleccionado] = useState('');
  const [particionesDeseadas, setParticionesDeseadas] = useState(6);
  const [retencionDeseadaHoras, setRetencionDeseadaHoras] = useState(1);

  const [ultimaOperacion, setUltimaOperacion] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  /** Envoltorio comun de llamada a la API con manejo de error. */
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

  const verCluster = useCallback(
    () => ejecutar(async () => setCluster(await estadoCluster())),
    [ejecutar]
  );

  const verTopics = useCallback(
    () => ejecutar(async () => setTopics(await listarTopics(incluirInternos))),
    [ejecutar, incluirInternos]
  );

  const verGrupos = useCallback(
    () => ejecutar(async () => setGrupos(await listarGrupos())),
    [ejecutar]
  );

  // Estado inicial al abrir, para que un cluster caido se note de inmediato.
  useEffect(() => {
    verCluster();
    verTopics();
  }, [verCluster, verTopics]);

  /** Crea el topic descrito en el formulario. */
  const crear = () =>
    ejecutar(async () => {
      const resultado = await crearTopic({
        nombre: nuevo.nombre.trim(),
        particiones: Number(nuevo.particiones),
        replicas: Number(nuevo.replicas),
        retencionMs: Number(nuevo.retencionHoras) * 60 * 60 * 1000,
        crearDlt: nuevo.crearDlt,
      });
      setUltimaOperacion(resultado);
      setAlerta({ tipo: 'ok', texto: resultado.detalle });
      setTopics(await listarTopics(incluirInternos));
    });

  /** Amplia las particiones del topic seleccionado. */
  const ampliar = () =>
    ejecutar(async () => {
      const resultado = await ampliarParticiones(seleccionado, particionesDeseadas);
      setUltimaOperacion(resultado);
      setAlerta({ tipo: 'ok', texto: resultado.detalle });
      setTopics(await listarTopics(incluirInternos));
    });

  /** Cambia la retencion del topic seleccionado. */
  const cambiarRetencion = () =>
    ejecutar(async () => {
      const ms = Number(retencionDeseadaHoras) * 60 * 60 * 1000;
      const resultado = await configurarTopic(seleccionado, {
        'retention.ms': String(ms),
      });
      setUltimaOperacion(resultado);
      setAlerta({ tipo: 'ok', texto: resultado.detalle });
      setTopics(await listarTopics(incluirInternos));
    });

  /**
   * Doble barrera: el navegador evita el clic distraido y el servidor vuelve a
   * exigir confirmacion para los topicos del flujo de pedidos, de modo que una
   * llamada directa no se salte la primera.
   */
  const eliminar = () => {
    const esDelNegocio = ETAPAS_PIPELINE.some(
      (e) => e.topic === seleccionado || `${e.topic}${SUFIJO_DLT}` === seleccionado
    );

    const aviso = esDelNegocio
      ? `El topic ${seleccionado} pertenece al flujo de pedidos. Eliminarlo borra ` +
        'el log completo y no se puede deshacer. Continuar?'
      : `Eliminar el topic ${seleccionado}? La operacion no se puede deshacer.`;

    if (!window.confirm(aviso)) return;

    return ejecutar(async () => {
      const resultado = await eliminarTopic(seleccionado, esDelNegocio);
      setUltimaOperacion(resultado);
      setAlerta({ tipo: 'ok', texto: resultado.detalle });
      setSeleccionado('');
      setTopics(await listarTopics(incluirInternos));
    });
  };

  /** Busca en la tabla el topic seleccionado, para mostrar su forma actual. */
  const fichaSeleccionada = topics.find((t) => t.nombre === seleccionado);

  return (
    <div className="kfk-pagina">
      <h2>Administración del clúster Kafka</h2>

      <p className="kfk-intro">
        El clúster tiene <strong>tres nodos Zookeeper</strong> y{' '}
        <strong>tres brokers</strong>. Zookeeper mantiene el acuerdo entre los
        nodos y elige al broker coordinador; los brokers guardan los registros.
        Cada topic se declara con <strong>tres particiones</strong> y{' '}
        <strong>tres réplicas</strong>, de modo que la caída de un nodo no deja
        ninguna partición sin copias disponibles.
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <header className="kfk-tarjeta-cabecera">
          <h3>1. Estado del clúster</h3>
          <button type="button" onClick={verCluster} disabled={trabajando}>
            Consultar brokers
          </button>
        </header>

        <p className="kfk-ayuda">
          El <strong>coordinador</strong> es el broker que lleva el registro de
          particiones y líderes. Si se detiene su contenedor, los demás eligen a
          otro a través de Zookeeper y el clúster sigue operando: eso es lo que
          se comprueba volviendo a consultar aquí.
        </p>

        {cluster ? (
          <>
            <p className="kfk-resumen">
              Clúster <code>{cluster.clusterId}</code> con{' '}
              <strong>{cluster.cantidadBrokers} broker(s)</strong> disponible(s).
              Coordinador: broker <strong>{cluster.coordinador}</strong>.
            </p>
            <table className="kfk-tabla">
              <thead>
                <tr>
                  <th>Broker</th>
                  <th>Host</th>
                  <th>Puerto</th>
                  <th>Rol</th>
                </tr>
              </thead>
              <tbody>
                {cluster.brokers.map((b) => (
                  <tr key={b.id}>
                    <td className="kfk-destacado">{b.id}</td>
                    <td>{b.host}</td>
                    <td>{b.puerto}</td>
                    <td>
                      {b.id === cluster.coordinador ? 'coordinador' : 'broker'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="kfk-vacio">Sin consultar.</p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <header className="kfk-tarjeta-cabecera">
          <h3>2. Topics del clúster</h3>
          <div className="kfk-acciones">
            <label className="kfk-ayuda">
              <input
                type="checkbox"
                checked={incluirInternos}
                onChange={(e) => setIncluirInternos(e.target.checked)}
              />{' '}
              incluir internos
            </label>
            <button type="button" onClick={verTopics} disabled={trabajando}>
              Actualizar
            </button>
          </div>
        </header>

        <p className="kfk-ayuda">
          <strong>Réplicas</strong> son los brokers que guardan una copia;{' '}
          <strong>en sincronía</strong> son las que están al día con el líder. Si
          las copias en sincronía bajan de <code>min.insync.replicas</code>, el
          topic deja de aceptar escrituras con <code>acks=all</code>: es la
          protección que evita aceptar un mensaje que podría perderse. Haga clic
          en una fila para seleccionar el topic y operar sobre él.
        </p>

        {topics.length === 0 ? (
          <p className="kfk-vacio">No hay topics para mostrar.</p>
        ) : (
          <table className="kfk-tabla">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Particiones</th>
                <th>Réplicas</th>
                <th>En sincronía</th>
                <th>Retención</th>
                <th>Limpieza</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => {
                const sincroMinima = Math.min(
                  ...t.detalle.map((p) => p.replicasEnSincro.length)
                );
                const retencion = t.configuracion['retention.ms'];
                return (
                  <tr
                    key={t.nombre}
                    onClick={() => setSeleccionado(t.nombre)}
                    className={t.nombre === seleccionado ? 'kfk-destacado' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <code>{t.nombre}</code>
                    </td>
                    <td>{t.particiones}</td>
                    <td>{t.replicas}</td>
                    <td className={sincroMinima < t.replicas ? 'kfk-retraso' : ''}>
                      {Number.isFinite(sincroMinima) ? sincroMinima : '-'}
                    </td>
                    <td>
                      {retencion
                        ? `${Math.round(Number(retencion) / 3600000)} h`
                        : 'heredada'}
                    </td>
                    <td>{t.configuracion['cleanup.policy'] ?? 'heredada'}</td>
                    <td>
                      {t.interno ? 'interno' : t.esDlt ? 'fallidos (.DLT)' : 'negocio'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <h3>3. Crear un topic</h3>

        <p className="kfk-ayuda">
          El clúster arranca con la creación automática de topics{' '}
          <strong>desactivada</strong>. Es deliberado: con ella activada, un
          error de tipeo en el nombre crearía un topic nuevo y vacío en lugar de
          dar error, y el problema aparecería mucho después. Las réplicas no
          pueden superar la cantidad de brokers (3).
        </p>

        <div className="kfk-formulario">
          <label>
            Nombre
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
          </label>
          <label>
            Particiones
            <input
              type="number"
              min="1"
              max="50"
              value={nuevo.particiones}
              onChange={(e) => setNuevo({ ...nuevo, particiones: e.target.value })}
            />
          </label>
          <label>
            Réplicas
            <input
              type="number"
              min="1"
              max="3"
              value={nuevo.replicas}
              onChange={(e) => setNuevo({ ...nuevo, replicas: e.target.value })}
            />
          </label>
          <label>
            Retención (horas)
            <input
              type="number"
              min="1"
              value={nuevo.retencionHoras}
              onChange={(e) => setNuevo({ ...nuevo, retencionHoras: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={nuevo.crearDlt}
              onChange={(e) => setNuevo({ ...nuevo, crearDlt: e.target.checked })}
            />{' '}
            crear también su topic <code>.DLT</code>
          </label>
          <button type="button" onClick={crear} disabled={trabajando}>
            Crear topic
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <h3>4. Modificar o eliminar el topic seleccionado</h3>

        {!seleccionado ? (
          <p className="kfk-vacio">
            Seleccione un topic haciendo clic en una fila de la tabla anterior.
          </p>
        ) : (
          <>
            <p className="kfk-resumen">
              Topic seleccionado: <code>{seleccionado}</code>
              {fichaSeleccionada
                ? ` — ${fichaSeleccionada.particiones} partición(es), factor ${fichaSeleccionada.replicas}.`
                : ''}
            </p>

            <p className="kfk-ayuda">
              Las particiones <strong>solo se pueden aumentar</strong>. Kafka no
              permite reducirlas porque la partición de destino de una clave se
              calcula como <code>hash(clave) módulo particiones</code>: quitar
              particiones cambiaría el destino de las claves ya publicadas y se
              perdería la garantía de orden. Aumentarlas tampoco reubica lo ya
              escrito, así que una misma clave puede quedar repartida en dos
              particiones. Por eso en producción el número de particiones se
              dimensiona al crear el topic.
            </p>

            <div className="kfk-formulario">
              <label>
                Particiones (solo aumentar)
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={particionesDeseadas}
                  onChange={(e) => setParticionesDeseadas(e.target.value)}
                />
              </label>
              <button type="button" onClick={ampliar} disabled={trabajando}>
                Ampliar particiones
              </button>
            </div>

            <p className="kfk-ayuda">
              La <strong>retención</strong> es el tiempo que el broker conserva
              los registros. En Kafka el mensaje <em>no</em> se borra al ser
              leído: se borra cuando vence este plazo. Por eso un grupo
              consumidor nuevo puede leer eventos antiguos y por eso se puede
              reprocesar el historial moviendo el offset hacia atrás.
            </p>

            <div className="kfk-formulario">
              <label>
                Retención (horas)
                <input
                  type="number"
                  min="1"
                  value={retencionDeseadaHoras}
                  onChange={(e) => setRetencionDeseadaHoras(e.target.value)}
                />
              </label>
              <button type="button" onClick={cambiarRetencion} disabled={trabajando}>
                Aplicar retención
              </button>
            </div>

            <div className="kfk-acciones">
              <button type="button" onClick={eliminar} disabled={trabajando}>
                Eliminar topic
              </button>
            </div>
          </>
        )}

        <MensajeAlerta {...(alerta ?? {})} />

        {ultimaOperacion?.aviso && (
          <p className="kfk-ayuda">
            <strong>Aviso:</strong> {ultimaOperacion.aviso}
          </p>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <header className="kfk-tarjeta-cabecera">
          <h3>5. Pipeline de eventos del negocio</h3>
          <button type="button" onClick={verGrupos} disabled={trabajando}>
            Consultar grupos y retraso
          </button>
        </header>

        <p className="kfk-ayuda">
          Las dos etapas del recorrido. Observe que <code>grupo-inventario</code>{' '}
          y <code>grupo-notificaciones</code> leen el <strong>mismo</strong>{' '}
          topic: al tener grupos distintos, <em>ambos</em> reciben todos los
          eventos, porque Kafka guarda un offset por grupo. Si compartieran
          grupo, cada evento llegaría a uno solo de los dos. Para generar
          tráfico, cree un pedido en la pantalla de Mensajería.
        </p>

        <table className="kfk-tabla">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Topic</th>
              <th>Publica</th>
              <th>Consume</th>
            </tr>
          </thead>
          <tbody>
            {ETAPAS_PIPELINE.map((e, indice) => (
              <tr key={e.topic}>
                <td className="kfk-destacado">{indice + 1}</td>
                <td>
                  <code>{e.topic}</code>
                </td>
                <td>{e.produce}</td>
                <td>{e.consume}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Grupos consumidores</h4>

        {grupos.length === 0 ? (
          <p className="kfk-vacio">
            Sin consultar. Los grupos aparecen una vez que sus consumidores se
            conectaron al clúster al menos una vez.
          </p>
        ) : (
          <table className="kfk-tabla">
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Estado</th>
                <th>Miembros</th>
                <th>Topics</th>
                <th>Retraso total</th>
                <th>Microservicio</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const propio = GRUPOS_DEL_NEGOCIO.find((x) => x.grupo === g.grupo);
                return (
                  <tr key={g.grupo}>
                    <td>
                      <code>{g.grupo}</code>
                    </td>
                    <td>{g.estado}</td>
                    <td>{g.miembros}</td>
                    <td>{g.topics.join(', ') || '-'}</td>
                    <td className={g.retrasoTotal > 0 ? 'kfk-retraso' : ''}>
                      {g.retrasoTotal}
                    </td>
                    <td>{propio ? propio.servicio : 'laboratorio / otro'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="kfk-ayuda">
          Un <strong>retraso</strong> que crece de forma sostenida indica que el
          consumidor no alcanza el ritmo del productor. La respuesta habitual es
          subir la concurrencia del consumidor, y para eso tienen que haber
          particiones suficientes: un grupo no puede tener más consumidores
          activos que particiones.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <h3>6. Respuestas sin procesar</h3>
        <p className="kfk-ayuda">
          El JSON exacto que devolvió cada endpoint, útil para comprobar los
          nombres de los campos y descartar que la vista esté transformando algo.
        </p>
        <PanelJson titulo="GET /api/kafka/admin/cluster" datos={cluster} />
        <PanelJson titulo="GET /api/kafka/admin/topics" datos={topics} />
        <PanelJson titulo="GET /api/kafka/admin/grupos" datos={grupos} />
        <PanelJson titulo="Última operación de administración" datos={ultimaOperacion} />
      </section>
    </div>
  );
}
