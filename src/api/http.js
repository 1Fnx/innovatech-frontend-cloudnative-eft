import axios from "axios";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance } from "../msalInstance";
import { protectedResources } from "../authConfig.js";

// Cliente HTTP hacia la API protegida. La URL base apunta al microservicio
// cuando se trabaja en local y al API Manager cuando el sistema esta desplegado.
export const http = axios.create({
  baseURL: protectedResources.api.endpoint,
});

// Interceptor: obtiene el Access Token con acquireTokenSilent y lo adjunta
// como "Authorization: Bearer <token>" en cada petición.
// (Equivalente en React al MsalInterceptor de Angular)
http.interceptors.request.use(async (config) => {
  const account = msalInstance.getActiveAccount();
  if (!account) return config;

  try {
    const result = await msalInstance.acquireTokenSilent({
      account,
      scopes: protectedResources.api.scopes,
    });
    config.headers.Authorization = `Bearer ${result.accessToken}`;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({
        scopes: protectedResources.api.scopes,
      });
    }
    throw error;
  }
  return config;
});
