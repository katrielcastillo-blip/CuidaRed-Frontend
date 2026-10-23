<p align="center">
  <img src="public/brand/logo.png" alt="CuidaRed · Seguimiento Comunitario" width="280" />
</p>

# CuidaRed: frontend (PWA) · v1.0.0

**CuidaRed** es una Aplicación Web Progresiva (PWA) *mobile-first* para el **seguimiento comunitario de adultos mayores vulnerables** en la República Dominicana. Permite a organizaciones comunitarias, iglesias, fundaciones, juntas de vecinos, voluntarios y familiares responsables registrar perfiles, gestionar visitas, registrar necesidades pendientes, recibir alertas sobre casos prioritarios, consultar un resumen del seguimiento y emitir reportes, con control de acceso por rol y funcionamiento sin conexión.

> CuidaRed no sustituye servicios médicos, instituciones públicas ni organismos de emergencia.

Proyecto académico del curso **IDS352-01 Anteproyecto de Grado**, Instituto Tecnológico de Santo Domingo (**INTEC**), 2026. Especificación: *SRS CuidaRed, Sprint 7*.

## Alcance implementado (SRS)

| Requisito | Dónde |
|---|---|
| RF-01 Perfiles de adultos mayores (identificación, condición general, riesgo social, consentimiento) | `src/features/gestion` · `src/domain/api/adultos.ts` |
| RF-02 Visitas comunitarias (fecha, responsable, observaciones, checklist, historial) | `src/features/visitas` · `src/domain/api/visitas.ts` |
| RF-03 Necesidades pendientes (registro, estado, historial) | `src/features/visitas` · `src/domain/api/necesidades.ts` |
| RF-04 Alertas de caso prioritario (riesgo "Alto" o medicamentos pendientes, sin duplicados) | `src/domain/reglas.ts` |
| RF-05 Alerta de seguimiento familiar (> 15 días calendario sin visita, umbral configurable) | `src/domain/reglas.ts` |
| RF-06 Formularios móviles (≤ 5 campos de texto, listas/casillas, abreviaturas, objetivos de 48 px) | `src/components/ui` · formularios |
| RF-07 Módulo de resumen (orden por prioridad, estado, última visita o riesgo) | `src/features/gestion` (ruta `resumen`) |
| RF-08 Reportes estadísticos (adultos, visitas, necesidades frecuentes, casos prioritarios; CSV/PDF) | `src/features/gestion` (ruta `reportes`) |
| RF-09 Control de acceso por roles (Administrador, Coordinador, Voluntario, Familiar responsable) | `src/domain/permisos.ts` · `src/app/guards.tsx` |
| RF-10 Registro sin conexión y sincronización automática con Last-Write-Wins (UTC) | `src/domain/sync.ts` · `src/domain/conectividad.ts` |
| Auditoría, sesiones seguras, contraseñas con hash, recuperación con código | `src/domain/auditoria.ts` · `auth.ts` · `seguridad.ts` · `sesion.ts` |
| Identidad, ayuda en línea, "Acerca de", avisos legales y de privacidad | `src/layouts` · `src/features/sistema` · `src/features/auth` |

### Alineación con la base de datos (modelo V3.0)

El modelo de datos del frontend reproduce **todas las tablas y columnas** del diseño de BD del equipo («2026.09.25 Normalización BD CuidaRed», modelo final V3.0): Cuenta, Configuracion_Cuenta, Parametros, Plan, Pago, Usuario, Membresia, Rol, Cuidador, Notificacion, Envejeciente, Contacto_emergencia, Vinculo, Env_Riesgo, Indicacion_Medica, Visita, RegistroVisita, DetalleVisita, Env_Necesidad, AlertaEnvejeciente, Tarea_agenda, Evidencias y todos sus catálogos. Cada tabla tiene su pantalla para capturarse y consultarse según el rol. El mapeo tabla ↔ tipo ↔ pantalla, los datos que exige el SRS y la BD aún no tiene, y las observaciones sobre el diseño están en [`docs/MAPEO-BD.md`](docs/MAPEO-BD.md).

Los módulos de la BD que van más allá del SRS se pueden usar, pero sin lógica que el SRS excluya:
- **Plan y suscripción:** informativo, sin cobros (SRS §8.1).
- **Indicaciones médicas:** acceso restringido; solo se transcribe lo indicado por personal de salud.
- **Agenda de cuidado con evidencias** y **perfiles de cuidador**.

La trazabilidad completa requisito → caso de uso → pantalla → prueba está en [`docs/RTM.md`](docs/RTM.md). El manual de usuario para coordinadores y voluntarios está en [`docs/MANUAL-USUARIO.md`](docs/MANUAL-USUARIO.md).

## Tecnologías

React 19 · TypeScript · Vite 8 · **Tailwind CSS 4** (tema en `tailwind.config.ts`) · React Router 7 · vite-plugin-pwa (Service Worker + Web App Manifest) · lucide-react · Playwright (pruebas). Licencias de terceros: [`LICENSES.md`](LICENSES.md).

## Instalación y ejecución local

Requisitos: Node.js 20 LTS o superior y npm.

```bash
npm install
cp .env.example .env.local   # opcional en esta versión (ver "Variables de entorno")
npm run dev                  # http://localhost:5173 (también accesible desde el teléfono: http://<IP-del-PC>:5173)
npm run build                # compilación de producción + Service Worker (dist/)
npm run preview              # sirve dist/ para probar la instalación como app y el modo sin conexión
```

## Variables de entorno

Ver [`.env.example`](.env.example). Esta entrega es **solo frontend**: el "servidor central" se simula en el navegador (localStorage para los datos compartidos y IndexedDB para la cola sin conexión), por lo que ninguna variable es obligatoria. Están reservadas para la integración con el backend previsto por el SRS:

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL de la API REST (Node.js + Express). Desarrollo `http://localhost:3000`; producción solo HTTPS. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Proyecto de Supabase (solo la clave pública *anon*; la *service_role* nunca va en el frontend). |
| `VITE_SESION_MINUTOS_INACTIVIDAD` | Minutos de inactividad para cerrar la sesión (por defecto 30). |

### Conectar con Supabase (cuando exista el backend)

1. Crear el proyecto en Supabase y habilitar Auth (correo y contraseña).
2. Crear las tablas en `snake_case` equivalentes a `src/domain/types.ts` (organizaciones, usuarios, familias, adultos, visitas, necesidades, alertas, auditoria) con integridad referencial y políticas RLS por rol.
3. Exponerlas a través de la API Express (`VITE_API_URL`), que valida token, rol y datos.
4. Sustituir la implementación local de `src/domain/api/*` y `src/domain/store.ts` por llamadas HTTP a la API. Las pantallas no cambian: solo usan la capa de servicios.

## Cuentas de demostración (contraseña `Demo1234`)

| Rol | Correo |
|---|---|
| Administrador | admin@cuidared.do |
| Coordinador | coordinador@cuidared.do |
| Voluntario | voluntario@cuidared.do |
| Familiar responsable | familiar@cuidared.do |

En la pantalla de inicio, «Cuentas de demostración» rellena el formulario. Para volver al estado inicial: Mi perfil → «Restablecer datos de demostración».

**Probar el modo sin conexión:** apaga la red del dispositivo, o en Conexión y sincronización activa «Simular sin conexión en este dispositivo». Las visitas y necesidades quedan «Pendientes de sincronización» y se envían solas al volver la conexión. Cada pestaña del navegador actúa como un dispositivo distinto (útil para provocar conflictos *Last-Write-Wins*).

## Estructura

```
src/
  domain/        Modelo (types.ts, alineado con la BD V3.0), datos maestros (datosMaestros.ts), relaciones,
                 permisos (RBAC por vínculos), motor de alertas, auditoría, sesión, seguridad,
                 sincronización offline y capa de servicios (api/) que hace de "backend" local.
  components/ui/ Kit de componentes accesibles (objetivos de 48 px, ayuda en línea, abreviaturas).
  layouts/       AppShell responsive: barra superior (logo, usuario y rol, conexión, notificaciones), menú y pie.
  features/      Pantallas por rol (admin, coordinador, voluntario, familiar) y módulos compartidos
                 (auth, perfil, gestion, visitas, agenda, sistema).
tests/           Pruebas unitarias del dominio y suites E2E por caso de uso (RTM).
docs/            RTM, mapeo con la BD (MAPEO-BD.md), manual de usuario y guía para desarrolladores (AGENTES.md).
```

## Pruebas

```bash
npm run typecheck                    # tipos
npm run lint                         # análisis estático
npx playwright install chromium      # una sola vez
npm run test:e2e                     # unitarias + E2E (móvil 360×640 y escritorio)
npx playwright test --project=unit   # solo las unitarias del dominio
node scripts/smoke.mjs               # recorrido de todas las rutas × 4 roles × 3 anchos
```

## Equipo

Equipo CuidaRed (Equipo de Trabajo #5), INTEC, 2026:

- Edgardo Santos
- Giselle Ventura
- Katriel Castillo
- Natasha Torres
- Seline Feliz

## Licencia

© 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados. Software académico (MVP) sin licencia de explotación comercial; uso restringido a pilotos controlados con organizaciones seleccionadas (SRS §12). Dependencias de código abierto bajo sus licencias (MIT, ISC, Apache 2.0, OFL): ver [`LICENSES.md`](LICENSES.md).
