/*
 * PanelJson.jsx
 * Muestra la respuesta del microservicio sin formatear. Deja a la vista el
 * JSON exacto que llego por la red, lo que ayuda al depurar.
 */
export default function PanelJson({ titulo, datos }) {
  if (datos === null || datos === undefined) return null;
  return (
    <div className="rmq-json">
      {titulo && <div className="rmq-json-titulo">{titulo}</div>}
      <pre>{JSON.stringify(datos, null, 2)}</pre>
    </div>
  );
}
