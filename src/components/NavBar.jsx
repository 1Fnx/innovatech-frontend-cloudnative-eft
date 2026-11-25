import { Link } from "react-router-dom";
import AuthButtons from "./AuthButtons.jsx";

export default function NavBar() {
  return (
    <header className="nav">
      <div className="brand">🐶 Innovatech · Tienda de Perritos</div>
      <nav className="links">
        <Link to="/">Inicio</Link>
        <Link to="/productos">Productos</Link>
        <Link to="/api">Probar API</Link>
        <Link to="/mensajeria">Mensajería</Link>
        <Link to="/admin-rabbit">Admin RabbitMQ</Link>
        <Link to="/kafka">Kafka</Link>
        <Link to="/admin-kafka">Admin Kafka</Link>
      </nav>
      <div className="auth">
        <AuthButtons />
      </div>
    </header>
  );
}
