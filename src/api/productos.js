import { http } from "./http";

export const listarProductos = () => http.get("/productos").then((r) => r.data);
export const obtenerProducto = (id) => http.get(`/productos/${id}`).then((r) => r.data);
export const crearProducto = (p) => http.post("/productos", p).then((r) => r.data);
export const actualizarProducto = (id, p) => http.put(`/productos/${id}`, p).then((r) => r.data);
export const eliminarProducto = (id) => http.delete(`/productos/${id}`).then((r) => r.data);
