import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import Claims from "../components/Claims";

export default function Home() {
  return (
    <section>
      <h1>Bienvenido a la Tienda de Perritos</h1>
      <UnauthenticatedTemplate>
        <p className="info">
          Inicia sesión con tu cuenta de Microsoft Entra External ID para
          administrar los productos.
        </p>
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <p className="info ok">Sesión iniciada correctamente.</p>
        <Claims />
      </AuthenticatedTemplate>
    </section>
  );
}
