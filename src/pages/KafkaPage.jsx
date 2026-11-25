/*
 * KafkaPage.jsx
 * -----------------------------------------------------------------------------
 * Pantalla del laboratorio de Apache Kafka.
 *
 * Reproduce en el navegador las mismas pruebas que la guia plantea por linea
 * de comandos, de modo que los dos caminos se puedan comparar:
 *
 *   1. Estado del servicio y descripcion del topic -> kafka-topics.sh --describe
 *   2. Prueba A: tres registros sin clave          -> reparto del particionador
 *   3. Prueba B: tres registros con la misma clave -> afinidad y orden
 *   4. Envio manual, para experimentar con claves propias
 *   5. Registros que leyo el consumidor            -> lineas RECIBIDO de la consola
 *   6. Avance del grupo consumidor                 -> kafka-consumer-groups.sh --describe
 *
 * Las cifras que se muestran aqui las entrega el broker, igual que a los
 * comandos, por lo que deben coincidir con lo que aparece en la terminal y en
 * la consola Kafka UI.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  CLAVE_DE_PRUEBA,
  PRUEBA_CON_CLAVE,
  PRUEBA_SIN_CLAVE,
  describirGrupo,
  describirTopic,
  limpiarRecibidos,
  listarRecibidos,
  publicarMensaje,
  publicarSecuencia,
  saludKafka,
} from '../api/apiKafka';
import PanelJson from '../components/PanelJson';
import MensajeAlerta from '../components/MensajeAlerta';
import '../estilos/kafka-ui.css';

export default function KafkaPage() {
  const [salud, setSalud] = useState(null);
  const [topico, setTopico] = useState(null);
  const [grupo, setGrupo] = useState(null);
  const [recibidos, setRecibidos] = useState([]);

  // Resultados de cada publicacion, con la particion y el offset asignados.
  const [publicaciones, setPublicaciones] = useState([]);

  // Formulario de envio manual.
  const [mensaje, setMensaje] = useState('Mensaje de prueba');
  const [clave, setClave] = useState('');

  const [alerta, setAlerta] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  /** Centraliza el manejo de errores de cualquier llamada a la API. */
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

  const revisarSalud = useCallback(
    () => ejecutar(async () => setSalud(await saludKafka())),
    [ejecutar]
  );

  const verTopico = useCallback(
    () => ejecutar(async () => setTopico(await describirTopic())),
    [ejecutar]
  );

  const verGrupo = useCallback(
    () => ejecutar(async () => setGrupo(await describirGrupo())),
    [ejecutar]
  );

  const verRecibidos = useCallback(
    () => ejecutar(async () => setRecibidos(await listarRecibidos())),
    [ejecutar]
  );

  // Al abrir la pantalla se consulta el estado inicial. Asi la vista no parte
  // vacia y se nota de inmediato si el broker no esta disponible.
  useEffect(() => {
    revisarSalud();
    verTopico();
  }, [revisarSalud, verTopico]);

  /** Prueba A: tres registros sin clave. */
  const pruebaSinClave = () =>
    ejecutar(async () => {
      const resultados = await publicarSecuencia(PRUEBA_SIN_CLAVE);
      setPublicaciones((previas) => [
        ...resultados.map((r) => ({ ...r, prueba: 'A - sin clave' })),
        ...previas,
      ]);
      const particiones = [...new Set(resultados.map((r) => r.particion))];
      setAlerta({
        tipo: 'ok',
        texto:
          `Se publicaron tres registros sin clave. Quedaron en ${particiones.length} ` +
          `particion(es): ${particiones.join(', ')}. ` +
          'El reparto 0, 1, 2 no es obligatorio: el particionador por defecto puede ' +
          'agrupar varios registros sin clave en la misma particion.',
      });
      setRecibidos(await listarRecibidos());
    });

  /** Prueba B: tres registros con la misma clave. */
  const pruebaConClave = () =>
    ejecutar(async () => {
      const resultados = await publicarSecuencia(PRUEBA_CON_CLAVE);
      setPublicaciones((previas) => [
        ...resultados.map((r) => ({ ...r, prueba: 'B - con clave' })),
        ...previas,
      ]);
      const particiones = [...new Set(resultados.map((r) => r.particion))];
      const offsets = resultados.map((r) => r.offset).join(', ');
      setAlerta({
        tipo: particiones.length === 1 ? 'ok' : 'error',
        texto:
          particiones.length === 1
            ? `Los tres registros con la clave ${CLAVE_DE_PRUEBA} quedaron en la particion ` +
              `${particiones[0]}, con offsets crecientes (${offsets}). La particion exacta ` +
              'no esta prefijada: depende del hash de la clave y del numero de particiones.'
            : `Los registros se repartieron en las particiones ${particiones.join(', ')}, ` +
              'lo que no deberia ocurrir con una misma clave. Revise el topic y el particionador.',
      });
      setRecibidos(await listarRecibidos());
    });

  /** Envio manual, con la clave que se escriba en el formulario. */
  const enviarManual = () =>
    ejecutar(async () => {
      const resultado = await publicarMensaje(mensaje, clave);
      setPublicaciones((previas) => [{ ...resultado, prueba: 'Manual' }, ...previas]);
      setAlerta({ tipo: 'ok', texto: resultado.mensajeLegible });
      setRecibidos(await listarRecibidos());
    });

  const limpiarVista = () =>
    ejecutar(async () => {
      const respuesta = await limpiarRecibidos();
      setRecibidos([]);
      setPublicaciones([]);
      setAlerta({ tipo: 'info', texto: respuesta.aviso });
    });

  return (
    <div className="kfk-pagina">
      <h2>Mensajeria con Apache Kafka: topics, particiones y offsets</h2>
      <p className="kfk-intro">
        El topic <code>innovatech.laboratorio.particiones</code> tiene tres
        particiones y tres replicas, una por broker. Cada
        particion es un registro ordenado y de solo agregado, con su propia
        numeracion de <strong>offsets</strong>. Al publicar{' '}
        <strong>sin clave</strong>, el particionador elige la particion sin
        consultar ningun criterio del mensaje. Al publicar{' '}
        <strong>con clave</strong>, la particion se calcula a partir del hash de
        esa clave, de modo que los registros que la comparten quedan juntos y en
        orden.
      </p>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <header className="kfk-tarjeta-cabecera">
          <h3>1. Estado del servicio y del topic</h3>
          <div className="kfk-acciones">
            <button type="button" onClick={revisarSalud} disabled={trabajando}>
              Revisar servicio
            </button>
            <button type="button" onClick={verTopico} disabled={trabajando}>
              Describir topic
            </button>
          </div>
        </header>

        <p className="kfk-ayuda">
          La comprobacion de vida responde sin consultar al broker: confirma que
          la aplicacion Spring Boot del puerto 8888 esta atendiendo peticiones.
          La descripcion del topic si consulta al cluster, por lo que es la que
          revela si Kafka esta disponible.
        </p>

        <ul className="kfk-salud">
          <li>
            <span className={`kfk-punto kfk-punto-${salud ? 'verde' : 'gris'}`} />
            <span className="kfk-salud-nombre">ms-kafka (8888)</span>
            <span className="kfk-salud-detalle">
              {salud
                ? `${salud.mensaje} - topic ${salud.topicLaboratorio}`
                : 'sin consultar'}
            </span>
          </li>
          <li>
            <span className={`kfk-punto kfk-punto-${topico ? 'verde' : 'gris'}`} />
            <span className="kfk-salud-nombre">cluster Kafka (9092 / 9093 / 9094)</span>
            <span className="kfk-salud-detalle">
              {topico
                ? `topic ${topico.topic} con ${topico.particiones} particiones y factor ${topico.replicas}`
                : 'sin consultar'}
            </span>
          </li>
        </ul>

        {topico && (
          <table className="kfk-tabla">
            <thead>
              <tr>
                <th>Particion</th>
                <th>Lider</th>
                <th>Replicas</th>
                <th>Avance del log</th>
              </tr>
            </thead>
            <tbody>
              {topico.detalle.map((p) => (
                <tr key={p.particion}>
                  <td>{p.particion}</td>
                  <td>{p.lider}</td>
                  <td>{p.replicas.join(', ')}</td>
                  <td>{p.ultimoOffset}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <h3>2. Publicar registros</h3>

        <div className="kfk-acciones">
          <button type="button" onClick={pruebaSinClave} disabled={trabajando}>
            Prueba A: tres registros sin clave
          </button>
          <button type="button" onClick={pruebaConClave} disabled={trabajando}>
            Prueba B: tres registros con clave {CLAVE_DE_PRUEBA}
          </button>
        </div>

        <div className="kfk-formulario">
          <label>
            Mensaje
            <input value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
          </label>
          <label>
            Clave (opcional)
            <input
              value={clave}
              placeholder="dejar vacio para publicar sin clave"
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
          <button type="button" onClick={enviarManual} disabled={trabajando}>
            Publicar
          </button>
        </div>

        <MensajeAlerta {...(alerta ?? {})} />

        {publicaciones.length > 0 && (
          <>
            <h4>Respuestas del broker</h4>
            <p className="kfk-ayuda">
              Cada fila es la confirmacion de que el broker escribio el registro
              en el log. No significa que un consumidor ya lo haya procesado:
              eso se comprueba en el paso 3.
            </p>
            <table className="kfk-tabla">
              <thead>
                <tr>
                  <th>Prueba</th>
                  <th>Clave</th>
                  <th>Mensaje</th>
                  <th>Particion</th>
                  <th>Offset</th>
                  <th>Instante</th>
                </tr>
              </thead>
              <tbody>
                {publicaciones.map((p, indice) => (
                  <tr key={`${p.particion}-${p.offset}-${indice}`}>
                    <td>{p.prueba}</td>
                    <td>{p.key ?? <em>(sin clave)</em>}</td>
                    <td>{p.valor}</td>
                    <td className="kfk-destacado">{p.particion}</td>
                    <td className="kfk-destacado">{p.offset}</td>
                    <td>{p.instante}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <header className="kfk-tarjeta-cabecera">
          <h3>3. Registros que leyo el consumidor</h3>
          <div className="kfk-acciones">
            <button type="button" onClick={verRecibidos} disabled={trabajando}>
              Actualizar
            </button>
            <button type="button" onClick={limpiarVista} disabled={trabajando}>
              Limpiar vista
            </button>
          </div>
        </header>

        <p className="kfk-ayuda">
          Es la misma informacion que el <code>@KafkaListener</code> imprime en
          la consola del servidor. Limpiar la vista solo borra esta ventana en
          memoria: el log de Kafka y los offsets del grupo no se modifican.
        </p>

        {recibidos.length === 0 ? (
          <p className="kfk-vacio">Todavia no se han consumido registros.</p>
        ) : (
          <table className="kfk-tabla">
            <thead>
              <tr>
                <th>#</th>
                <th>Particion</th>
                <th>Offset</th>
                <th>Clave</th>
                <th>Mensaje</th>
                <th>Grupo</th>
                <th>Procesado</th>
              </tr>
            </thead>
            <tbody>
              {recibidos.map((r) => (
                <tr key={r.secuencia}>
                  <td>{r.secuencia}</td>
                  <td className="kfk-destacado">{r.particion}</td>
                  <td className="kfk-destacado">{r.offset}</td>
                  <td>{r.key ?? <em>(sin clave)</em>}</td>
                  <td>{r.valor}</td>
                  <td>{r.grupo}</td>
                  <td>{r.recibidoEn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <header className="kfk-tarjeta-cabecera">
          <h3>4. Avance del grupo consumidor</h3>
          <button type="button" onClick={verGrupo} disabled={trabajando}>
            Consultar offsets del grupo
          </button>
        </header>

        <p className="kfk-ayuda">
          Equivale al comando <code>kafka-consumer-groups.sh --describe</code>.
          El <strong>offset confirmado</strong> es el punto desde el que el grupo
          retomaria la lectura tras un reinicio; el <strong>retraso</strong> es
          lo que le falta leer. Un valor <code>-1</code> indica que el grupo aun
          no ha confirmado nada en esa particion, situacion distinta de haber
          confirmado el offset cero. Como la confirmacion es automatica y
          periodica, conviene esperar unos segundos antes de consultar.
        </p>

        {grupo && (
          <>
            <p className="kfk-resumen">
              Grupo <code>{grupo.grupo}</code> en estado{' '}
              <strong>{grupo.estado}</strong> con {grupo.miembros} miembro(s)
              activo(s).
            </p>
            <table className="kfk-tabla">
              <thead>
                <tr>
                  <th>Particion</th>
                  <th>Offset confirmado</th>
                  <th>Final del log</th>
                  <th>Retraso</th>
                </tr>
              </thead>
              <tbody>
                {grupo.avance.map((a) => (
                  <tr key={a.particion}>
                    <td>{a.particion}</td>
                    <td className="kfk-destacado">{a.offsetActual}</td>
                    <td>{a.offsetFinalLog}</td>
                    <td className={a.retraso > 0 ? 'kfk-retraso' : ''}>{a.retraso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="kfk-tarjeta">
        <h3>5. Respuestas sin procesar</h3>
        <p className="kfk-ayuda">
          El JSON exacto que devolvio cada endpoint, util para comprobar los
          nombres de los campos y descartar que la vista este transformando algo.
        </p>
        <PanelJson titulo="GET /api/kafka/health" datos={salud} />
        <PanelJson titulo="GET /api/kafka/topico" datos={topico} />
        <PanelJson titulo="GET /api/kafka/grupo" datos={grupo} />
      </section>
    </div>
  );
}
