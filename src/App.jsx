import { Routes, Route } from "react-router-dom";
import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import NavBar from "./components/NavBar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Productos from "./pages/Productos.jsx";
import ApiPage from "./pages/ApiPage.jsx";
import MensajeriaPage from "./pages/MensajeriaPage.jsx";
import AdminRabbitPage from "./pages/AdminRabbitPage.jsx";
import KafkaPage from "./pages/KafkaPage.jsx";
import AdminKafkaPage from "./pages/AdminKafkaPage.jsx";

export default function App() {
  return (
    <>
      <NavBar />
      <main className="container">
        <UnauthenticatedTemplate>
          <p className="info">
            Debe iniciar sesión para acceder al contenido protegido.
          </p>
        </UnauthenticatedTemplate>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/productos"
            element={
              <ProtectedRoute>
                <Productos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api"
            element={
              <ProtectedRoute>
                <ApiPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mensajeria"
            element={
              <ProtectedRoute>
                <MensajeriaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-rabbit"
            element={
              <ProtectedRoute>
                <AdminRabbitPage />
              </ProtectedRoute>
            }
          />
          {/*
            La pantalla de Kafka no se envuelve en ProtectedRoute. Los endpoints
            de ms-kafka son publicos, porque el laboratorio se centra en
            particiones y offsets y no en identidad. Una pantalla que exigiera
            sesion para consumir una API abierta seria incoherente, y asi el
            laboratorio tambien se puede demostrar sin iniciar sesion.
          */}
          <Route path="/kafka" element={<KafkaPage />} />
          {/*
            La administracion del cluster sigue el mismo criterio que la
            pantalla anterior: los endpoints de ms-kafka son publicos, por lo
            que exigir sesion aqui seria incoherente. En un despliegue real
            estas operaciones irian detras del mismo filtro de seguridad que
            protege la API de productos, y la ruta se envolveria en
            ProtectedRoute igual que /admin-rabbit.
          */}
          <Route path="/admin-kafka" element={<AdminKafkaPage />} />
        </Routes>
      </main>
    </>
  );
}