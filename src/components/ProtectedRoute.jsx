import { MsalAuthenticationTemplate } from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { loginRequest } from "../authConfig.js";

/**
 * ProtectedRoute 
 * Equivalente conceptual al MsalGuard de Angular.
 * Si el usuario no está autenticado, MSAL inicia el login por redirección.
 */
export default function ProtectedRoute({ children }) {
  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
      loadingComponent={() => <p className="info">Verificando sesión…</p>}
      errorComponent={({ error }) => (
        <p className="info error">Error de autenticación: {error?.message}</p>
      )}
    >
      {children}
    </MsalAuthenticationTemplate>
  );
}
