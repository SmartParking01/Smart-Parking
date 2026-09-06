# Smart Parking — Sistema Inteligente de Parqueo

Proyecto universitario: aplicación para gestionar parqueos privados (malls,
hospitales, residenciales, hoteles, universidades privadas, empresas) en
tiempo real, con reserva de espacios, validación por código QR y panel
administrativo para el personal de seguridad.

> No depende de APIs municipales. Cada empresa administra su propio parqueo
> dentro de la plataforma.

## 1. Estructura del proyecto

```
smart-parking/
├── backend/              API REST (Node.js + Express + PostgreSQL)
├── frontend-user/        App del conductor (HTML/CSS/JS, estilo móvil)
├── frontend-admin/       Panel administrativo (ADMIN y SECURITY)
└── README.md
```

## 2. Arquitectura

```
 App conductor (frontend-user)         Panel admin/guarda (frontend-admin)
            │                                       │
            └───────────────┬───────────────────────┘
                             │  HTTPS / REST (JSON)
                             ▼
                     Backend (Express)
        ┌────────────┬────────────┬─────────────┬───────────┐
        │  Routes    │ Middleware │ Controllers │ Services  │
        │            │ (auth/rol) │             │ (QR, stats)│
        └────────────┴────────────┴─────────────┴───────────┘
                             │
                             ▼
                    Base de datos PostgreSQL
     (users, establishments, parking_spaces, reservations, entries)
```

La lógica de negocio (estado real de cada espacio, validez de reservas,
validación de QR) vive **siempre en el backend**. El frontend nunca decide
por sí mismo si un espacio está libre; solo refleja lo que el servidor
responde.

## 3. Instalación y ejecución

### Requisitos
- Node.js 18 o superior
- PostgreSQL 13 o superior (local, Docker, o un servicio en la nube como
  Render/Railway/Supabase/Neon)

### Base de datos

Crea una base de datos vacía llamada `smartparking` (o el nombre que prefieras,
solo ajusta las variables de entorno):

```bash
# Ejemplo con psql en una instalación local
createdb smartparking
```

El backend crea automáticamente las tablas (`users`, `establishments`,
`parking_spaces`, `reservations`, `entries`) la primera vez que arranca o que
corres `npm run seed` — no hace falta correr un script `.sql` aparte.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # ajusta credenciales de PostgreSQL y secretos
npm run seed               # crea las tablas (si no existen) + datos de demostración
npm run start               # o "npm run dev" para reinicio automático
```

En `.env` puedes usar `DATABASE_URL` (una sola cadena de conexión, típica de
proveedores en la nube) **o** las variables sueltas `PGHOST`, `PGPORT`,
`PGUSER`, `PGPASSWORD`, `PGDATABASE`. Si defines `DATABASE_URL`, esa tiene
prioridad. Si tu proveedor exige SSL, pon `PGSSL=true`.

El servidor queda escuchando en `http://localhost:4000`.

Cuentas de prueba creadas por `npm run seed`:

| Rol      | Correo                        | Contraseña  |
|----------|-------------------------------|-------------|
| ADMIN    | admin@smartparking.test       | Admin123!   |
| SECURITY | guarda@smartparking.test      | Guard123!   |
| USER     | conductor@smartparking.test   | User123!    |

Se crea también el establecimiento "Mall Plaza Central" con 12 espacios
(filas A y B).

### Frontend — App del conductor

Abre `frontend-user/index.html` directamente en el navegador (o sírvelo con
cualquier servidor estático, por ejemplo `npx serve frontend-user`). Por
defecto apunta a `http://localhost:4000/api` (editable en `js/api.js`).

### Frontend — Panel administrativo

Abre `frontend-admin/index.html` de la misma forma. Inicia sesión con la
cuenta ADMIN o SECURITY.

> Ambos frontend son páginas estáticas (HTML/CSS/JS puro, sin frameworks ni
> build step), pensadas con una interfaz tipo app móvil para el conductor y
> un panel tipo dashboard para el personal del parqueo.

## 4. Flujo principal (MVP) — probado de punta a punta

```
REGISTRO → LOGIN → CONSULTAR PARQUEO → VER ESPACIOS → RESERVAR →
GENERAR QR → ESCANEAR QR → INGRESO → OCUPACIÓN → SALIDA →
LIBERACIÓN DEL ESPACIO → HISTORIAL
```

Este flujo se validó manualmente contra la API (registro/login, creación de
reserva con QR firmado, bloqueo de reservas duplicadas del mismo espacio,
escaneo y validación del QR por el guarda, registro de salida y liberación
del espacio, y asignación manual para conductores sin reserva).

## 5. Casos de uso principales

1. **Usuario con reserva**: reserva un espacio → recibe QR → el guarda lo
   escanea → se valida (firma del QR, existencia y vigencia de la reserva,
   que corresponda al establecimiento y al espacio) → ingreso autorizado →
   espacio pasa a OCUPADO → al salir, el guarda libera el espacio.
2. **Persona sin reserva (walk-in)**: llega sin reservar → el guarda ve los
   espacios disponibles en tiempo real → asigna uno manualmente → el sistema
   registra la entrada igual que cualquier otra (no se permite el ingreso sin
   quedar registrado).
3. **Administración del parqueo**: el ADMIN crea establecimientos, espacios,
   personal (guardas u otros admins), y consulta estadísticas de ocupación y
   una predicción básica por hora basada en el historial de entradas.

## 6. Estados de los espacios

`AVAILABLE → RESERVED → OCCUPIED → AVAILABLE` (con reserva) o
`AVAILABLE → OCCUPIED → AVAILABLE` (walk-in). También existe `BLOCKED` para
espacios fuera de servicio (mantenimiento, etc.), controlado por el ADMIN.

Las transiciones de estado usan una operación atómica de "comparar y
establecer" en la base de datos (el nuevo estado solo se aplica si el estado
anterior era el esperado), lo que evita que dos personas reserven u ocupen el
mismo espacio al mismo tiempo.

## 7. Seguridad implementada

- Contraseñas con hashing `bcrypt` (nunca en texto plano).
- Autenticación con JWT y expiración configurable.
- Autorización por rol (`USER`, `SECURITY`, `ADMIN`) en cada endpoint sensible.
- El contenido del QR no incluye datos personales del usuario: solo un
  identificador de reserva, firmado con un secreto (`QR_SECRET`) distinto al
  de la sesión. Modificar el contenido del QR invalida la firma y la
  validación se rechaza.
- Variables sensibles fuera del código, en `.env` (ver `.env.example`).
- Validación de entradas (formato de correo, longitud de contraseña, formato
  de código de espacio, existencia de relaciones antes de crear registros).

## 8. Materias reflejadas en el proyecto

- **Lenguajes formales**: formalización de estados de los espacios como un
  autómata simple (`AVAILABLE/RESERVED/OCCUPIED/BLOCKED` con transiciones
  controladas), validación de formato de correo y de código de espacio con
  expresiones regulares.
- **Matemáticas**: porcentaje de ocupación, promedios de entradas por hora y
  por día de la semana, clasificación de niveles de ocupación para la
  predicción.
- **Diseño de medios**: jerarquía visual por color de estado, navegación tipo
  app móvil (bottom nav) para el conductor y dashboard lateral para el
  personal, diseño responsivo.
- **Redes**: arquitectura cliente-servidor sobre HTTP con API REST en JSON,
  autenticación por token en cada solicitud.
- **Base de datos**: modelo relacional en PostgreSQL con llaves foráneas,
  restricciones `CHECK` para los estados y roles, índices para las consultas
  más frecuentes, y operaciones atómicas de "comparar y establecer" vía
  `UPDATE ... WHERE` para evitar condiciones de carrera.

## 9. Notas para ampliar el proyecto

- El escaneo de QR en el panel actualmente se hace pegando el contenido leído
  (para simplificar sin depender de librerías externas de cámara); se puede
  reemplazar fácilmente por una librería de lectura por cámara (ej. `jsQR`)
  que llame a la misma función `Api.post("/entries/scan-qr", ...)`.
- El sistema de notificaciones está preparado a nivel de datos (estados y
  eventos claros: reserva creada, ingreso autorizado, próxima expiración) pero
  no se implementó un canal de envío (push/email) para mantener el MVP simple.
- La predicción de ocupación es intencionalmente simple (clasificación
  ALTA/MEDIA/BAJA por promedio histórico) y mejora automáticamente conforme se
  acumulan más entradas reales.
