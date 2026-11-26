import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * El build de produccion se publica bajo el prefijo /app/ del API Manager,
 * que es quien aporta el HTTPS que exige el proveedor de identidad. En
 * desarrollo la aplicacion sigue sirviendose desde la raiz, de modo que el
 * mismo codigo funciona en los dos entornos sin tocar nada.
 */
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/app/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
}));
