/*
 * TarjetaSalud.jsx
 * -----------------------------------------------------------------------------
 * Consulta el endpoint publico /api/health de los cuatro microservicios y
 * muestra un semaforo, de modo que se detecta de un vistazo si alguno de los
 * cuatro servicios dejo de responder.
 */
import { useCallback, useEffect, useState } from 'react';
import { saludPedidos } from '../api/apiPedidos';
import { saludNotificaciones, saludProductos } from '../api/apiProcesos';
import { saludAdmin } from '../api/apiRabbitAdmin';

const SERVICIOS = [
  { clave: 'ms-productos (8081)', fn: saludProductos },
  { clave: 'ms-pedidos (8082)', fn: saludPedidos },
  { clave: 'ms-notificaciones (8083)', fn: saludNotificaciones },
  { clave: 'ms-admin-rabbit (8084)', fn: saludAdmin },
];

export default function TarjetaSalud() {
  const [estado, setEstado] = useState({});
  const [cargando, setCargando] = useState(false);

  const revisar = useCallback(async () => {
    setCargando(true);
    const resultado = {};
    // Se consultan en paralelo: son cuatro servicios independientes.
    await Promise.all(
      SERVICIOS.map(async (servicio) => {
        try {
          const datos = await servicio.fn();
          resultado[servicio.clave] = { ok: true, datos };
        } catch (error) {
          resultado[servicio.clave] = { ok: false, datos: error.message };
        }
      })
    );
    setEstado(resultado);
    setCargando(false);
  }, []);

  useEffect(() => {
    revisar();
  }, [revisar]);

  return (
    <section className="rmq-tarjeta">
      <header className="rmq-tarjeta-cabecera">
        <h3>Estado de los microservicios</h3>
        <button type="button" onClick={revisar} disabled={cargando}>
          {cargando ? 'Revisando...' : 'Revisar de nuevo'}
        </button>
      </header>
      <ul className="rmq-salud">
        {SERVICIOS.map((servicio) => {
          const item = estado[servicio.clave];
          const clase = !item ? 'gris' : item.ok ? 'verde' : 'rojo';
          return (
            <li key={servicio.clave}>
              <span className={`rmq-punto rmq-punto-${clase}`} />
              <span className="rmq-salud-nombre">{servicio.clave}</span>
              <span className="rmq-salud-detalle">
                {!item
                  ? 'sin consultar'
                  : item.ok
                  ? `ARRIBA - ${item.datos?.servicio ?? 'ok'}`
                  : `CAIDO - ${item.datos}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
