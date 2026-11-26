import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance } from "./msalInstance";
import App from "./App.jsx";
import "./index.css";

async function bootstrap() {
  // MSAL v3 requiere initialize() antes de usar la instancia
  await msalInstance.initialize();

  // Procesa la respuesta del redirect de login (si venÃ­amos de Entra)
  await msalInstance.handleRedirectPromise();

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>
  );
}

bootstrap();

