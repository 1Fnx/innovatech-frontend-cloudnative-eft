# Innovatech - Frontend React + MSAL

SPA React (Vite) que se autentica contra **Microsoft Entra External ID** usando
**MSAL**, obtiene Access Tokens y consume la API protegida enviando el token en
la cabecera `Authorization: Bearer`.

Implementado siguiendo la guía docente "Configurar MSAL en un frontend React".

## Equivalencias Angular -> React (guía docente, sección 2)

| En Angular | Aquí en React |
|---|---|
| `MsalGuard` | `components/ProtectedRoute.jsx` con `MsalAuthenticationTemplate` |
| `MsalInterceptor` | `api/http.js` (interceptor axios + `acquireTokenSilent`) |
| `MsalService` | `useMsal()` en `components/AuthButtons.jsx` |
| `environment.ts` | `.env` + `import.meta.env` |
| `main.ts` | `src/main.jsx` |

## Configuración

1. `cp .env.example .env`
2. Rellenar con los datos de Azure:

| Variable | Dónde se obtiene |
|---|---|
| `VITE_AZURE_TENANT_TYPE` | `ciam` (External ID) o `corporate` (Entra ID clásico) |
| `VITE_AZURE_CLIENT_ID` | App registration del SPA > Overview |
| `VITE_AZURE_TENANT_ID` | App registration > Overview (Directory ID) |
| `VITE_AZURE_TENANT_SUBDOMAIN` | Solo si es CIAM. Lo previo a `.onmicrosoft.com` |
| `VITE_REDIRECT_URI` | Debe coincidir EXACTO con Authentication > SPA |
| `VITE_API_SCOPE` | Scopes expuestos por el backend |

> Tras modificar `.env` hay que reiniciar `npm run dev`.
> **Nunca** se coloca un client secret en el frontend.

## Ejecutar
```bash
npm install
npm run dev
# http://localhost:5173
```

## Rutas
| Ruta | Descripción |
|---|---|
| `/` | Inicio. Autenticado muestra los claims del token |
| `/productos` | CRUD protegido (requiere sesión) |
| `/api` | Pruebas manuales de 200 / 401 / 403 |
| `/mensajeria` | Crear pedidos y ver la bitacora de los consumidores (RabbitMQ y Kafka) |
| `/admin-rabbit` | Administrar colas, exchanges y bindings de RabbitMQ |
| `/kafka` | Laboratorio de Kafka: publicar con y sin clave, particiones y offsets |
| `/admin-kafka` | Administrar el clúster de Kafka: brokers, topics y grupos consumidores |

## Capacidades de autenticación
- Login / logout con `loginRedirect` / `logoutRedirect`
- Guard de rutas que exige autenticación
- Token adjuntado automáticamente en cada llamada
- Lectura de **roles y scopes** desde los claims del token

## Estructura
```
src/
├── authConfig.js            # configuración MSAL (authority, scopes)
├── msalInstance.js          # PublicClientApplication
├── main.jsx                 # bootstrap + MsalProvider
├── App.jsx                  # rutas
├── api/
│   ├── http.js              # axios + token (equiv. MsalInterceptor)
│   └── productos.js
├── components/
│   ├── AuthButtons.jsx      # login / logout
│   ├── NavBar.jsx
│   ├── ProtectedRoute.jsx   # equiv. MsalGuard
│   └── Claims.jsx           # muestra roles y scopes
└── pages/
    ├── Home.jsx
    ├── Productos.jsx
    └── ApiPage.jsx          # pruebas 200/401/403
```

## Pantallas de mensajeria

Ademas del catalogo heredado, la aplicacion expone dos pantallas que operan
sobre la mensajeria asincrona con RabbitMQ:

| Ruta | Pantalla | Que permite |
|---|---|---|
| `/mensajeria` | Mensajeria | Publicar un pedido y observar el trabajo asincrono: bitacora de los consumidores, stock descontado y simulacion de errores |
| `/admin-rabbit` | Administracion RabbitMQ | Crear, consultar, purgar y eliminar colas, exchanges y bindings a traves de ms-admin-rabbit |

Ambas requieren sesion iniciada. Los modulos que las sostienen son
`src/api/clienteHttp.js` (transporte y token), `src/api/apiPedidos.js`,
`src/api/apiProcesos.js` y `src/api/apiRabbitAdmin.js`.

Las cuatro direcciones de los microservicios se configuran con las variables
`VITE_MS_PRODUCTOS`, `VITE_MS_PEDIDOS`, `VITE_MS_NOTIFICACIONES` y
`VITE_MS_ADMIN_RABBIT` del archivo `.env`.

## Pantalla de Apache Kafka

| Ruta | Pantalla | Que permite |
|---|---|---|
| `/kafka` | Kafka | Publicar registros con y sin clave y observar la particion y el offset que asigna el broker, los registros que leyo el consumidor y el avance del grupo consumidor |
| `/admin-kafka` | Admin Kafka | Ver los brokers vivos y el coordinador; listar topics con sus particiones, replicas, replicas en sincronia y configuracion; crear, ampliar, reconfigurar y eliminar topics; y revisar los grupos consumidores con su retraso |

Ninguna de las dos exige sesion. Los endpoints de `ms-kafka` son publicos,
porque el laboratorio se centra en particiones y offsets y no en identidad; una
pantalla que pidiera inicio de sesion para consumir una API abierta seria
incoherente. Las pantallas del catalogo mantienen su guard de autenticacion.

La sostiene `src/api/apiKafka.js`, sobre el mismo `clienteHttp.js` que el resto,
y su hoja de estilos es `src/estilos/kafka-ui.css`. La direccion del
microservicio se configura con `VITE_MS_KAFKA` (por omision
`http://localhost:8888`).

Lo que se muestra en pantalla equivale a lo que se obtiene por consola:

| En la pantalla | Equivalente por linea de comandos |
|---|---|
| Estado del servicio y del topic | `kafka-topics --describe --topic innovatech.laboratorio.particiones` |
| Registros que leyo el consumidor | lineas `RECIBIDO` de la consola de Spring Boot |
| Avance del grupo consumidor | `kafka-consumer-groups --describe --group grupo-laboratorio` |
| Estado del clúster | `kafka-broker-api-versions --bootstrap-server localhost:9092` |
| Listado de topics | `kafka-topics --list` y `--describe` |
| Crear, ampliar y eliminar un topic | `kafka-topics --create / --alter / --delete` |
| Cambiar retencion o politica de limpieza | `kafka-configs --alter --entity-type topics` |
| Grupos consumidores y su retraso | `kafka-consumer-groups --describe --all-groups` |

La pantalla de administracion incluye ademas el mapa del **pipeline de eventos**
del negocio: las dos etapas y los tres grupos consumidores, con la observacion
de que `grupo-inventario` y `grupo-notificaciones` leen el **mismo** topic y aun
asi ambos reciben todos los eventos, porque Kafka guarda un offset por grupo.
Para generar trafico, se crea un pedido en la pantalla de Mensajeria.

El navegador nunca se conecta al puerto 9092: no habla el protocolo de Kafka.
El recorrido real es React -> HTTP -> Spring Boot -> protocolo Kafka -> broker.
