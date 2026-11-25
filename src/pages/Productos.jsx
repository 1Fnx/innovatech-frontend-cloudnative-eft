import { useEffect, useState } from "react";
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../api/productos";

const vacio = { nombre: "", descripcion: "", precio: "", stock: "" };

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(vacio);
  const [editandoId, setEditandoId] = useState(null);
  const [status, setStatus] = useState({ msg: "", tipo: "" });

  const setOk = (msg) => setStatus({ msg, tipo: "ok" });
  const setErr = (msg) => setStatus({ msg, tipo: "error" });

  async function cargar() {
    try {
      const data = await listarProductos();
      setProductos(data);
      setOk("Productos cargados correctamente.");
    } catch (e) {
      setErr("No se pudieron cargar los productos. " + (e.response?.status || e.message));
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  function onChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function limpiar() {
    setForm(vacio);
    setEditandoId(null);
  }

  async function guardar() {
    if (!form.nombre) return setErr("El nombre es obligatorio.");
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      precio: parseFloat(form.precio),
      stock: parseInt(form.stock, 10),
    };
    if (isNaN(payload.precio) || payload.precio < 0) return setErr("Precio inválido.");
    if (isNaN(payload.stock) || payload.stock < 0) return setErr("Stock inválido.");

    try {
      if (editandoId) {
        await actualizarProducto(editandoId, payload);
        setOk("Producto actualizado.");
      } else {
        await crearProducto(payload);
        setOk("Producto creado.");
      }
      limpiar();
      cargar();
    } catch (e) {
      setErr("Error al guardar (" + (e.response?.status || e.message) + ").");
    }
  }

  function editar(p) {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio: p.precio,
      stock: p.stock,
    });
  }

  async function borrar(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await eliminarProducto(id);
      setOk("Producto eliminado.");
      cargar();
    } catch (e) {
      setErr("Error al eliminar (" + (e.response?.status || e.message) + ").");
    }
  }

  return (
    <section>
      <h1>Productos</h1>
      {status.msg && <p className={"info " + status.tipo}>{status.msg}</p>}

      <div className="card">
        <div className="actions">
          <button className="btn" onClick={cargar}>Recargar</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Nombre</th><th>Descripción</th>
              <th>Precio</th><th>Stock</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.nombre}</td>
                <td>{p.descripcion}</td>
                <td>${Number(p.precio).toFixed(2)}</td>
                <td>{p.stock}</td>
                <td>
                  <button className="btn small" onClick={() => editar(p)}>Editar</button>
                  <button className="btn small danger" onClick={() => borrar(p.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>{editandoId ? `Editar producto #${editandoId}` : "Nuevo producto"}</h3>
        <div className="form-grid">
          <label>Nombre
            <input name="nombre" value={form.nombre} onChange={onChange} />
          </label>
          <label>Descripción
            <input name="descripcion" value={form.descripcion} onChange={onChange} />
          </label>
          <label>Precio
            <input name="precio" type="number" value={form.precio} onChange={onChange} />
          </label>
          <label>Stock
            <input name="stock" type="number" value={form.stock} onChange={onChange} />
          </label>
        </div>
        <div className="actions">
          <button className="btn" onClick={guardar}>Guardar</button>
          <button className="btn secondary" onClick={limpiar}>Cancelar</button>
        </div>
      </div>
    </section>
  );
}
