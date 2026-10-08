# CuidaRed Frontend: guía para los agentes que implementan pantallas

Proyecto: **React 19 + Vite 8 + TypeScript + react-router-dom 7 + vite-plugin-pwa**. Es una PWA instalable.
Estilos con **CSS Modules + design tokens** (`src/styles/tokens.css`). **No uses Tailwind** ni librerías de UI nuevas.
Iconos: **lucide-react** (ya instalado; sustituyen a los Material Symbols del Figma: home → House, elderly_woman → PersonStanding, medical_services → BriefcaseMedical, etc.).

## Fuente de diseño (Figma)
- Archivo: `fileKey = HxW01YqTEFOqwwysUi7FqT`. Usa el MCP de Figma: `get_design_context` (código + captura) y `get_screenshot` por nodo.
- El código que devuelve Figma es **posicionamiento absoluto a 428px**. NO lo copies tal cual: es solo referencia de textos, colores, tamaños y jerarquía. Reconstruye con flex/grid fluido.
- Si el MCP falla o te limita: `docs/figma/<seccion>.xml` tiene el árbol de nodos (los nombres de los nodos de texto = el texto) y `docs/figma/<seccion>.png` la vista general de la sección.
- Los assets de imagen de Figma caducan en 7 días: si necesitas uno (logo, ilustración), descárgalo a `public/assets/<tu-modulo>/` (o `public/brand/` para el logo, solo agente AUTH).

## Requisito principal: responsive real (móvil + web)
1. **Móvil primero y fiel al Figma** en 360–428px de ancho: mismos textos, colores, orden y proporciones.
2. **Tablet/escritorio (≥768px)**: el `AppShell` ya cambia el bottom-nav por un sidebar. Tu pantalla debe aprovechar el ancho:
   - Dashboards y listas: `<Page wide>` + rejillas (`.grid-auto`, `.grid-2`, o tu propio `grid-template-columns` con `@media (min-width: 768px / 1100px)`). Tarjetas en 2–3 columnas; KPIs en una fila; paneles lado a lado.
   - Formularios y detalles: `<Page>` normal (máx. ~680px centrado). Campos cortos en 2 columnas en ≥768 (nombre/apellido, teléfono/fecha…).
   - Pantallas de auth: tarjeta centrada (máx. ~460px) sobre el fondo decorativo; en ≥1100 puede haber panel de marca a la izquierda.
3. **Prohibido**: anchos fijos en px para contenedores, `position:absolute` para el layout, scroll horizontal y textos cortados. Usa `min()`, `clamp()`, `%`, `fr`.
4. Objetivos táctiles de al menos 44px, `font-size` de 16px o más en inputs (evita el zoom en iOS), y `env(safe-area-inset-*)` ya resuelto en el shell.
5. Verifica con capturas (el servidor de desarrollo ya corre en http://localhost:5173):
   `node scripts/shot.mjs <ruta> <cuidador|familiar|admin|coordinador|anon> <nombre> [--tablet] [--full]`
   Genera `shots/<nombre>-mobile.png` (390px) y `-desktop.png` (1280px). Ábrelas con Read y compáralas con la captura de Figma. El script avisa de scroll horizontal y de errores de consola.

## Arquitectura (no la cambies)
- `src/domain/`: tipos (`types.ts`), datos semilla (`seed.ts`), store (`store.ts`) y sesión (`auth.ts`). **Solo lectura para ti.**
  - Leer: `useDB(s => s.adultos)` (devuelve referencias del estado; deriva/filtra con `useMemo`, **nunca** crees arrays nuevos dentro del selector porque provoca un bucle infinito).
  - Escribir: `mutate(db => { db.visitas.push({...}) })`. Ids nuevos: `uid('v')`.
  - Sesión: `useSession()` → `{ user, org }`, `useUser()`, `login()`, `logout()`, `HOME_BY_ROL`, `nombreCompleto()`.
  - Fechas: `src/domain/dates.ts` (`fechaLarga`, `fechaCorta`, `hora12`, `relativo`, `edad`, `todayISO`…).
  - Si necesitas un campo o dato nuevo, **no edites el dominio**: guárdalo dentro de tu módulo (p. ej. un helper local) y menciónalo en tu reporte final.
- `src/components/ui/`: kit compartido (**solo lectura**): `Button`, `ButtonLink`, `TextField`, `PasswordField`, `SelectField`, `TextareaField`, `SearchInput`, `Checkbox`, `Switch`, `ChoicePills`, `Badge`, `RiesgoBadge`, `Avatar`, `Card`, `LinkCard`, `IconTile`, `StatTile`, `Datum`, `InfoRow`, `Segmented`, `Chip`, `EmptyState`, `Spinner`, `StepBar`, `Sheet` (bottom-sheet en móvil / diálogo en escritorio), `SuccessOverlay` (pantallas "…registrada correctamente!"), `useToast`.
  Si te falta un componente, créalo en **tu** carpeta (`src/features/<tu-modulo>/components/`).
- `src/layouts/AppShell.tsx`: `AppShell` (lo montan las rutas del rol) y **`<Page title back leading actions wide>`**, la cabecera navy + contenedor que debe usar **cada pantalla autenticada**. `useShell().base` da la base del rol (`/admin`…), útil para construir enlaces en módulos compartidos.
- `src/styles/tokens.css` y `base.css`: **solo lectura**. Hay utilidades `.stack`, `.row`, `.row-between`, `.grid-auto`, `.grid-2`, `.section-title`, `.muted`, `.only-mobile`, `.only-desktop`.
- Rutas: cada área es dueña de su `routes.tsx` (ver `src/app/router.tsx`). Sustituye los `<Placeholder>` por tus pantallas reales. Puedes añadir rutas dentro de tu área.

## Reglas de trabajo en paralelo (IMPORTANTE: hay otros 5 agentes editando a la vez)
- Edita **solo** los archivos y carpetas de tu módulo (se indican en tu encargo). No toques `package.json`, el dominio, el kit UI, los layouts, los tokens ni las carpetas de otros agentes.
- **No instales dependencias.** No ejecutes `git` (ni commit ni checkout ni stash). No arranques otro servidor de desarrollo: ya hay uno en el puerto 5173.
- Para comprobar tipos: `npx tsc -p tsconfig.app.json --noEmit`. Puede haber errores temporales en carpetas ajenas: **ignóralos**. Los de tu carpeta deben quedar en 0.
- Todo en **español** (textos de UI, nombres de componentes y variables de dominio como en el resto del código). Prohibidos `enum` y los parameter properties (`erasableSyntaxOnly`).
- Accesibilidad básica: `<button>`/`<Link>` reales, `label` en campos, `alt` en imágenes, contraste del Figma.
- Funcional de verdad: los formularios validan (campos requeridos, formato de correo/cédula/teléfono, contraseñas iguales) y **persisten en el store**. Los botones navegan. Los filtros y búsquedas filtran. Los contadores salen de los datos. Nada de pantallas muertas.

## Cuentas demo (contraseña `Demo1234`)
cuidador@cuidared.do · familiar@cuidared.do · admin@cuidared.do · coordinador@cuidared.do
