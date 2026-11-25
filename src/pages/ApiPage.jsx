import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { protectedResources } from "../authConfig.js";

/**
 * Banco de pruebas de la API protegida.
 *
 * Cada botón lanza una llamada con una condición distinta de autorización y
 * muestra el código HTTP y el cuerpo que devuelve la capa que respondió. Con la
 * URL base apuntando al microservicio se prueba la validación del backend; con
 * la URL base apuntando al API Manager se prueba la del gateway, que corta la
 * petición antes de que llegue al backend.
 */
export default function ApiPage() {
  const { instance, accounts } = useMsal();
  const [resultado, setResultado] = useState("");
  const [status, setStatus] = useState(null);

  async function obtenerToken() {
    const tokenRequest = {
      scopes: protectedResources.api.scopes,
      account: accounts[0],
    };
    try {
      const r = await instance.acquireTokenSilent(tokenRequest);
      return r.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect(tokenRequest);
        return null;
      }
      throw error;
    }
  }

  async function llamar(ruta, { conToken = true, tokenFalso = false } = {}) {
    setResultado("Llamando…");
    setStatus(null);
    try {
      const headers = {};
      if (tokenFalso) {
        headers.Authorization = "Bearer token.falso.invalido";
      } else if (conToken) {
        if (accounts.length === 0) {
          setResultado("Debe iniciar sesión primero.");
          return;
        }
        const token = await obtenerToken();
        if (!token) return;
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${protectedResources.api.endpoint}${ruta}`, { headers });
      setStatus(response.status);
      const data = await response.json().catch(() => ({}));
      setResultado(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(error);
      setResultado("Ocurrió un error al llamar la API: " + error.message);
    }
  }

  return (
    <section>
      <h1>Pruebas de la API protegida</h1>
      <p className="info">
        Cada botón lanza la misma llamada con una condición distinta de autorización.
      </p>

      <div className="card">
        <div className="actions" style={{ flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={() => llamar("/health", { conToken: false })}>
            1. Endpoint público (espera 200)
          </button>
          <button className="btn danger" onClick={() => llamar("/productos", { conToken: false })}>
            2. Sin token (espera 401)
          </button>
          <button className="btn danger" onClick={() => llamar("/productos", { tokenFalso: true })}>
            3. Token inválido (espera 401)
          </button>
          <button className="btn" onClick={() => llamar("/productos")}>
            4. Con token válido (espera 200)
          </button>
          <button className="btn" onClick={() => llamar("/me")}>
            5. Ver claims del token
          </button>
          <button className="btn secondary" onClick={() => llamar("/productos/admin/resumen")}>
            6. Endpoint solo rol Admin (403 si no lo tiene)
          </button>
        </div>

        {status !== null && (
          <p className={"info " + (status >= 200 && status < 300 ? "ok" : "error")}>
            Código HTTP de respuesta: <b>{status}</b>
          </p>
        )}
        <pre className="code">{resultado}</pre>
      </div>
    </section>
  );
}
