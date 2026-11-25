import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { protectedResources, authInfo } from "../authConfig.js";

/**
 * Muestra los claims del Access Token: aud, iss, scp (scopes) y roles.
 * Lee los roles y los ámbitos desde las afirmaciones del token y los muestra.
 */
export default function Claims() {
  const { instance } = useMsal();
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const account = instance.getActiveAccount();
    if (!account) return;
    instance
      .acquireTokenSilent({ account, scopes: protectedResources.api.scopes })
      .then((r) => {
        const payload = JSON.parse(atob(r.accessToken.split(".")[1]));
        setClaims(payload);
      })
      .catch((e) => setError(e.message));
  }, [instance]);

  if (error) return <p className="info error">No se pudo leer el token: {error}</p>;
  if (!claims) return null;

  return (
    <div className="card claims">
      <h3>Claims del Access Token</h3>
      <ul>
        <li><b>Usuario (name):</b> {claims.name || "—"}</li>
        <li><b>Subject (sub):</b> {claims.sub}</li>
        <li><b>Audience (aud):</b> {String(claims.aud)}</li>
        <li><b>Issuer (iss):</b> {claims.iss}</li>
        <li><b>Scopes (scp):</b> {claims.scp || "—"}</li>
        <li><b>Roles:</b> {(claims.roles || []).join(", ") || "—"}</li>
        <li><b>Expira (exp):</b> {new Date(claims.exp * 1000).toLocaleString()}</li>
      </ul>
      <p className="info" style={{ marginTop: 12 }}>
        <b>Authority en uso:</b> {authInfo.authority}<br />
        <b>Redirect URI:</b> {authInfo.redirectUri}
      </p>
    </div>
  );
}
