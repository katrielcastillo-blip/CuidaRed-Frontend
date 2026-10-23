# CuidaRed Frontend: guía para quien implementa pantallas

Proyecto: **React 19 + Vite 8 + TypeScript + react-router-dom 7 + vite-plugin-pwa + Tailwind CSS 4**. PWA instalable, mobile-first.
Fuente de requisitos: **SRS de CuidaRed (Sprint 7)**: RF-01 a RF-10, casos de uso CU-01 a CU-14 y requisitos no funcionales. Esta versión es **solo frontend**: el "servidor" se simula en el navegador.

## Estilos: solo Tailwind
- **Prohibido crear `.module.css`** y estilos en CSS nuevos. Todo con utilidades de Tailwind en `className` (y `cn()` de `@/lib/cn` para condicionales).
- Tema en `tailwind.config.ts` (SRS §18.1): colores `navy`, `navy-700`, `blue`, `blue-bright`, `blue-100`, `teal`, `teal-100`, `green`, `bg`, `surface`, `surface-2`, `line`, `line-soft`, `ink`, `ink-2`, `muted`, `danger(-100)`, `warning(-100/-700)`, `success(-100/-700)`, `info(-100)`, `riesgo-alto/medio/bajo`. Radios `rounded-sm` (7px), `rounded-md` (12px), `rounded-lg` (20px), `rounded-pill`. Sombras `shadow-1`, `shadow-2`. Breakpoints: `md` = 768px (tablet), `lg` = 1100px (escritorio). Fondos `bg-grad-auth`, `bg-grad-splash`.
- Variables CSS disponibles para valores arbitrarios: `var(--gutter)`, `var(--appbar-h)`, `var(--bottomnav-h)`, `var(--safe-bottom)`, `var(--content-max)`.
- Clases globales permitidas: `section-title`, `grid-auto` (rejilla 1→N columnas), `select-arrow`, `no-print`, `sr-only`. Las utilidades heredadas `.stack`, `.row`, `.row-between`, `.grid-2`, `.grid-3`, `.muted`, `.only-desktop`, `.only-mobile` están en `src/styles/legacy.css` **y se van a eliminar**: sustitúyelas por Tailwind (`flex flex-col gap-4`, `flex items-center gap-3`, `flex items-center justify-between gap-3`, `grid grid-cols-2 gap-4`, `text-muted`, `hidden md:block`, `md:hidden`).
- Contraste WCAG AA: texto `warning` y `success` sobre fondo claro → usa `text-warning-700` / `text-success-700`. No uses `text-teal` para texto pequeño.

## Requisitos de interfaz obligatorios (SRS)
1. **Objetivos táctiles ≥ 48×48 px** en TODO elemento interactivo (botones, enlaces-botón, chips, checkboxes, selects): `min-h-12`, `size-12`, `min-w-12` (RF-06 · WCAG 2.5.5). Inputs: `text-base` (16 px).
2. **Formularios principales** (perfil, visita, necesidad): máx. **5 campos de texto libre por pantalla**; el resto con listas, casillas, píldoras (`SelectField`, `CheckboxGroup`, `ChoicePills`). Completables con **un solo desplazamiento** a 360×640 (si no cabe, divide en pasos con `StepBar`). Validación por campo con mensaje junto al campo y **sin perder lo escrito** (`useBorrador` de `@/lib/useBorrador`).
3. **Ayuda en línea**: prop `help` en los campos del kit (muestra un botón "?" con explicación) o `hint`. Ponla en los campos que pueden generar dudas.
4. **Riesgo**: usa siempre `RiesgoBadge` (color + forma: triángulo/rombo/círculo, SRS §18.4).
5. Responsive real: móvil primero (360–428 px), sin scroll horizontal, sin anchos fijos; en ≥768 aprovecha el ancho (`<Page wide>` + rejillas).
6. Accesibilidad: `<button>`/`<Link>` reales, `label` en campos, `alt` en imágenes, `aria-*` cuando haga falta, foco visible.
7. Mensajes de error claros, sin detalles técnicos. Retroalimentación visual tras cada acción (toast o `SuccessOverlay`).
8. Todo en **español**. Prohibidos `enum` y parameter properties (`erasableSyntaxOnly`).
9. **Encabezado de archivo** en cada archivo nuevo o que modifiques (SRS §18.2):
   ```ts
   /*
    * NombreArchivo.tsx — Propósito breve.
    * Módulo: <módulo>.
    * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
    */
   ```

## Modelo de datos = BD V3.0
El dominio reproduce el modelo de base de datos del equipo (ver `docs/MAPEO-BD.md`). Puntos clave:
- **Acceso por `db.vinculos`.** El voluntario ve los adultos con vínculo `voluntario_asignado` y el familiar, los de `familiar_responsable`. No hay `cuidadorIds`, `familiaIds` ni familias.
- **Contactos de emergencia en `db.contactos`.** Para el principal usa `contactoPrincipal`.
- **Ubicación del adulto:** `municipioCod`, `zona` (sector) y `direccion`; usa `direccionCompleta`.
- **Configuración por parámetros:** léela con `configOrg(db, orgId)` o `valorParametro`; nunca uses `org.config`.
- **Catálogos en `db.catalogos`.** No los dupliques en el código.
- **Helpers de relaciones** en `src/domain/relaciones.ts`.

## Arquitectura de datos (no la cambies; pide cambios al orquestador)
- `src/domain/` (solo lectura para ti):
  - `types.ts` modelo; `catalogos.ts` listas predefinidas (ROLES, AUTONOMIAS, CONDICIONES, ASPECTOS_VISITA, ESTADOS_NECESIDAD, ESTADOS_ALERTA, TIPOS_ALERTA_TEXTO, TIPOS_NECESIDAD_TEXTO, ABREVIATURAS).
  - `store.ts`: `useDB(s => s.x)` para leer (selecciona referencias; deriva con `useMemo`, **nunca** crees arrays en el selector). **No llames a `mutate` desde las pantallas**: usa la capa de servicios.
  - `api/` (**capa de servicios = "backend" local**): toda escritura pasa por aquí. Valida datos, comprueba rol y alcance, escribe o encola offline y audita. Devuelven `Resultado` → `{ ok: true, valor, offline? } | { ok: false, error, errores? }`. Muestra `errores[campo]` junto a cada campo y `error` en un toast. Si `offline` es true, informa "Guardado en el dispositivo · pendiente de sincronización".
    - adultos: `crearAdulto`, `actualizarAdulto`, `cambiarEstadoAdulto`, `asignarVoluntarios`, `guardarEvaluacionRiesgo`, `anonimizarAdulto`, `validarAdulto`, `DATOS_ADULTO_VACIOS`, `datosDesdeAdulto`.
    - visitas (offline): `registrarVisita` (async), `iniciarVisita` (async), `programarVisita`, `cancelarVisita`, `validarVisita`.
    - necesidades (offline): `registrarNecesidad` (async), `cambiarEstadoNecesidad` (async), `validarNecesidad`.
    - alertas: `gestionarAlerta`, `alertasVisibles`, `notificacionesSinLeer`, `marcarLeidas`.
    - usuarios: `crearUsuario` (async), `actualizarUsuario`, `cambiarEstadoUsuario`, `eliminarUsuario`, `cambiarPassword` (async), `configurarOrganizacion`.
  - `permisos.ts`: `puede(user, accion, adulto?)`, `adultosVisibles(user, adultos)`, `alcanzaAdulto`, `MATRIZ`, `DESCRIPCION_ROL`. **Muestra u oculta acciones con `puede()`**; nunca compares el rol a mano.
  - `auth.ts`: `useSession()`, `useUser()`, `login()` (async), `logout()`, `HOME_BY_ROL`, `ROL_LABEL`, `nombreCompleto()`.
  - `conectividad.ts`: `useEnLinea()`. Las pantallas que **no** son visitas/necesidades deben deshabilitar su botón de guardar sin conexión y explicar por qué.
  - `sync.ts`: `usePendientes()`, registros con `pendienteSync: true` en la vista → muéstralos con `<Badge tone="warning">Pendiente de sincronización</Badge>`.
  - `reglas.ts`: motor automático de alertas RF-04/RF-05 (`diasSinVisita`, `ultimaVisitaCompletada`, `condicionesPrioritarias`).
  - `validacion.ts`: validadores compartidos (`errorNombre`, `errorCedula`, `errorTelefono`, `errorEmail`, `errorFechaNacimiento`, `errorTexto`, `hayErrores`…). `seguridad.ts`: `validarPassword`, `REGLAS_PASSWORD`.
  - `dates.ts`: `fechaLarga`, `fechaCorta`, `fechaHora`, `hora12`, `relativo`, `edad`, `todayISO`, `diasCalendario`…
- `src/components/ui/` (kit, solo lectura): `Button`, `ButtonLink`, `TextField`, `PasswordField`, `SelectField`, `TextareaField`, `TextareaAbreviado` (RF-06 abreviaturas), `SearchInput`, `Checkbox`, `CheckboxGroup`, `Switch`, `ChoicePills`, `Badge`, `RiesgoBadge`, `Avatar`, `Card`, `LinkCard`, `IconTile`, `StatTile`, `Datum`, `InfoRow`, `Segmented`, `Chip`, `EmptyState`, `Spinner`, `StepBar`, `HelpTip`, `Sheet`, `SuccessOverlay` (prop `detail`), `useToast`. Todos aceptan `help`/`hint`/`error` cuando son campos.
- `src/layouts/AppShell.tsx`: `<Page title back leading actions wide>` en cada pantalla autenticada; `useShell().base` da la base del rol. La barra superior (logo, usuario+rol, conexión, notificaciones) y el pie de página ya los pone el shell.
- `src/app/guards.tsx`: `RequireRole`, `RequirePermiso accion="…"` (envuelve rutas que requieren un permiso concreto; muestra "Acceso no autorizado").

## Roles (RF-09)
`admin` (Administrador) · `coordinador` (Coordinador) · `voluntario` (Voluntario, antes "cuidador") · `familiar` (Familiar responsable). Rutas: `/admin`, `/coordinador`, `/voluntario`, `/familiar`.
Cuentas demo (contraseña `Demo1234`): admin@cuidared.do · coordinador@cuidared.do · voluntario@cuidared.do · familiar@cuidared.do.

## Trabajo en paralelo
- Edita **solo** tu carpeta (se indica en tu encargo). No toques `package.json`, `src/domain`, el kit UI, layouts, estilos globales ni otras carpetas. No instales dependencias. No ejecutes `git`. No arranques otro servidor (ya corre en http://localhost:5173).
- Tipos: `npx tsc -p tsconfig.app.json --noEmit` → los errores de **tu** carpeta deben quedar en 0 (ignora los ajenos).
- Capturas: `node scripts/shot.mjs <ruta> <voluntario|familiar|admin|coordinador|anon> <nombre> [--full]` → `shots/<nombre>-mobile.png` (390 px) y `-desktop.png` (1280 px). Ábrelas con Read. Las capturas ANTES de la migración están en `shots/antes/` (`<rol>__<ruta>-mobile.png`; el rol voluntario aparece como `cuidador__cuidador_…`): la versión Tailwind debe verse igual o mejor.
- Si necesitas algo del dominio o del kit que no existe, créalo localmente en tu carpeta o descríbelo en tu reporte final.
