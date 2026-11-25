/*
 * useTokenApi.js
 * -----------------------------------------------------------------------------
 * Hook que obtiene el access token para llamar a nuestros microservicios.
 *
 * Primero intenta acquireTokenSilent (usa la sesion ya establecida y la cache
 * de MSAL). Si MSAL responde que hace falta interaccion del usuario, recien
 * entonces abre el popup. Asi evitamos molestar al usuario en cada click.
 */
import { useCallback } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { SCOPES_API } from '../api/clienteHttp';

export function useTokenApi() {
  const { instance, accounts } = useMsal();

  const obtenerToken = useCallback(async () => {
    if (accounts.length === 0) {
      throw new Error('No hay sesion activa. Debes iniciar sesion primero.');
    }

    const solicitud = { scopes: SCOPES_API, account: accounts[0] };

    try {
      const resultado = await instance.acquireTokenSilent(solicitud);
      return resultado.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const resultado = await instance.acquireTokenPopup(solicitud);
        return resultado.accessToken;
      }
      throw error;
    }
  }, [instance, accounts]);

  return { obtenerToken, cuenta: accounts[0] ?? null };
}
