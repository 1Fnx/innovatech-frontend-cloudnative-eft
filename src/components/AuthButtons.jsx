import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "../authConfig.js";

/**
 * Controles de inicio y cierre de sesión contra el proveedor de identidad.
 * useMsal()            -> entrega instance, accounts, inProgress
 * useIsAuthenticated() -> true si hay una cuenta autenticada
 * loginRedirect()      -> flujo interactivo por redirección hacia Entra ID
 * logoutRedirect()     -> cierra sesión y vuelve a postLogoutRedirectUri
 */
export default function AuthButtons() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = instance.getActiveAccount();

  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();

  return isAuthenticated ? (
    <>
      <span className="user">{account?.username}</span>
      <button className="btn danger" onClick={logout}>
        Cerrar sesión
      </button>
    </>
  ) : (
    <button className="btn" onClick={login}>
      Iniciar sesión
    </button>
  );
}
