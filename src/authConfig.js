import { LogLevel } from "@azure/msal-browser";

/**
 * authConfig.js
 * Centraliza la configuración de MSAL: autoridad, cliente y ámbitos.
 *
 * Soporta dos tipos de tenant:
 *  - ciam      -> Microsoft Entra External ID  (https://<sub>.ciamlogin.com/)
 *  - corporate -> Microsoft Entra ID clásico   (https://login.microsoftonline.com/<tenantId>)
 */

const tenantType = (import.meta.env.VITE_AZURE_TENANT_TYPE || "ciam").toLowerCase();
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
const subdomain = import.meta.env.VITE_AZURE_TENANT_SUBDOMAIN;
const redirectUri = import.meta.env.VITE_REDIRECT_URI || window.location.origin;

const esCiam = tenantType === "ciam";

// authority: endpoint del tenant contra el que se realiza el login
const authority = esCiam
  ? `https://${subdomain}.ciamlogin.com/${tenantId}`
  : `https://login.microsoftonline.com/${tenantId}`;

export const msalConfig = {
  auth: {
    clientId,
    authority,
    // knownAuthorities es OBLIGATORIO en tenants CIAM/External ID
    ...(esCiam ? { knownAuthorities: [`${subdomain}.ciamlogin.com`] } : {}),
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    // sessionStorage: el token vive mientras dure la pestaña (buena práctica)
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: () => {},
    },
  },
};

// Scopes de la API protegida (pueden venir varios separados por coma)
export const apiScopes = (import.meta.env.VITE_API_SCOPE || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Scopes de identidad OIDC + permisos de la API
export const loginRequest = {
  scopes: ["openid", "profile", ...apiScopes],
};

export const protectedResources = {
  api: {
    endpoint: import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api",
    scopes: apiScopes,
  },
};

// Se exporta para poder mostrar la configuración activa en pantalla
export const authInfo = { tenantType, authority, redirectUri };
