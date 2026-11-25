/*
 * MensajeAlerta.jsx
 * Caja de aviso reutilizable. Cuando el error viene del backend con detalles
 * de validacion campo por campo, los muestra en una lista.
 */
export default function MensajeAlerta({ tipo = 'info', texto, detalles }) {
  if (!texto) return null;
  return (
    <div className={`rmq-alerta rmq-alerta-${tipo}`}>
      <strong>{texto}</strong>
      {detalles && typeof detalles === 'object' && (
        <ul>
          {Object.entries(detalles).map(([campo, mensaje]) => (
            <li key={campo}>
              <code>{campo}</code>: {String(mensaje)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
