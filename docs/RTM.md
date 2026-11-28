# Matriz de Trazabilidad de Requisitos y Pruebas (RTM): CuidaRed Frontend v1.0.0

© 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.

Alineada con el SRS (Sprint 7) §6.6 y RSUP-04. Convención: `E2E-<CU>-<módulo>` ↔ `tests/e2e/e2e-cuXX-<módulo>.spec.ts`.
Cada suite se ejecuta en dos perfiles: **móvil 360×640** (resolución de referencia de RF-06) y **escritorio 1280×800**.

**Última ejecución:** `npx playwright test`: **142 pruebas superadas**, 0 fallidas, 2 omitidas por diseño (las mediciones de RF-06 solo aplican al perfil móvil). Unitarias: 36. E2E: 53 escenarios × 2 perfiles.

Estados (SRS §6.6): *Automatizado* · *En desarrollo* · *Pendiente* · *Bloqueado*.

## 1. Requisitos funcionales y casos de uso

| CU | Caso de uso | RF | Implementación principal | Suite E2E | Escenarios | Estado |
|---|---|---|---|---|---|---|
| CU-01 | Iniciar sesión | RF-09 | `domain/auth.ts`, `domain/seguridad.ts`, `domain/sesion.ts`, `features/auth/pages/Inicio.tsx` | E2E-CU01-AUTH | 6 (login por cada uno de los 4 roles, credenciales inválidas, cuenta desactivada) | Automatizado |
| CU-02 | Registrar perfil de adulto mayor | RF-01, RF-06 | `domain/api/adultos.ts` (`crearAdulto`), `features/gestion/components/AdultoForm.tsx` | E2E-CU02-PERFIL-CREATE | 3 (Gherkin §16.1) | Automatizado |
| CU-03 | Editar perfil | RF-01 | `actualizarAdulto`, `AdultoEditarPage.tsx` | E2E-CU03-PERFIL-EDIT | 3 | Automatizado |
| CU-04 | Consultar perfil | RF-01 | `AdultoPerfilPage.tsx`, `voluntario/pages/PerfilEnvejeciente.tsx`, `familiar/pages/PerfilAdulto.tsx` | E2E-CU04-PERFIL-VIEW | 3 | Automatizado |
| CU-05 | Registrar visita comunitaria | RF-02, RF-06, RF-10 | `domain/api/visitas.ts` (`registrarVisita`), `features/visitas/pages/RegistrarVisita.tsx` | E2E-CU05-VISITA | 3 Gherkin (§16.2) + RF-06 (48 px, ≤ 1 desplazamiento) | Automatizado |
| CU-06 | Consultar historial de visitas | RF-02 | Perfil del adulto, `DetalleVisita.tsx`, `voluntario/pages/MisVisitas.tsx` | E2E-CU06-HIST-VISITAS | 3 | Automatizado |
| CU-07 | Registrar necesidad pendiente | RF-03, RF-06, RF-10 | `domain/api/necesidades.ts` (`registrarNecesidad`), `RegistrarNecesidad.tsx` | E2E-CU07-NECESIDAD | 3 Gherkin (§16.3) + RF-06 | Automatizado |
| CU-08 | Actualizar estado de necesidad | RF-03 | `cambiarEstadoNecesidad`, `DetalleNecesidad.tsx` (historial de estados) | E2E-CU08-NECESIDAD-UPD | 3 | Automatizado |
| CU-09 | Generar alerta de caso prioritario | RF-04 | Modo conectado: el motor de alertas vive en la base (backend `src/modules/alertas/**`, `docs/propuestas/fase-6b-alertas-motor.sql` y `fase-6c-*`: una alerta por fuente, sin duplicados, cierre automático); `features/access-real/operacion/alertas.tsx` (Casos prioritarios, listado con filtros por estado, tipo y adulto, detalle, iniciar atención y resolver), `seguimiento.tsx` (enlace «Ver alertas de este adulto») | `tests/access/alertas.spec.ts` (Cuidador resuelve sin iniciar atención, filtros, paginación y errores al resolver) · `tests/access/fases-5-6.spec.ts` (agrupación en casos y ciclo del gestor) · backend `tests/alertas.test.js` | 9 de Playwright (7 en `alertas.spec.ts` y 2 en `fases-5-6.spec.ts`) × 2 perfiles + 59 de contrato en backend | Automatizado (modo conectado). Modo demo, solo en desarrollo: `domain/reglas.ts` · E2E-CU09-ALERTA-PRIOR · `reglas.spec.ts` |
| CU-10 | Gestionar alerta de seguimiento familiar | RF-05, RF-18 | Modo conectado: la regla «más de 15 días calendario desde la última visita completada» (umbral `dias_sin_visita_alerta`) y su evaluación diaria están en la base (`alerta_ventana_sin_visita` en `fase-6b-alertas-motor.sql`); `alertas.tsx` (bandejas Alertas y Notificaciones), campana con contador en `operacion/portal.tsx` (solo para quien recibe avisos: Coordinador y Administrador de Organización, regla `recibeAvisosDeAlertas` en `cuentas-datos.ts`), `notificaciones-push.tsx` (Web Push) | `tests/access/alertas.spec.ts` (campana visible u oculta por rol) · `tests/access/fases-5-6.spec.ts` (contador y lectura del aviso) · `tests/access/notificaciones-push.spec.ts` · `tests/access/operacion.spec.ts` (umbral en la configuración de la cuenta) · backend `tests/alertas.test.js` | 7 de campana por rol en `alertas.spec.ts` + 1 de contador en `fases-5-6.spec.ts` + 2 de Web Push, × 2 perfiles | Automatizado (modo conectado). Modo demo, solo en desarrollo: `domain/reglas.ts` · E2E-CU10-ALERTA-FAM · `reglas.spec.ts` |
| CU-11 | Consultar módulo de resumen | RF-07 | Modo conectado: `features/access-real/operacion/resumen-casos.tsx` (indicadores, lista con filtros, orden y paginación), `resumen-datos.ts` (filtros, orden y textos), `api/reportes.ts` (`/resumen-casos`) y ruta `/operacion/:cuentaId/resumen` con permiso `resumen:ver` en `portal.tsx` | `tests/access/reportes.spec.ts` (6 pruebas de resumen: indicadores, filtros, orden y búsqueda, enlace al expediente, estados vacíos; la de permisos por rol cubre también Reportes) · `tests/componentes/resumen-informe-datos.test.ts` | 6 de Playwright × 2 perfiles + 1 de permisos por rol + 15 unitarias | Automatizado (modo conectado). Modo demo, solo en desarrollo: `gestion/lib/resumen.ts`, `gestion/pages/ResumenPage.tsx` · E2E-CU11-RESUMEN (`e2e-cu11-resumen.spec.ts`) · 4 (§16.6) |
| CU-12 | Generar reporte estadístico | RF-08 | Modo conectado: `features/access-real/operacion/reportes.tsx` (tipos, filtros, indicadores, gráficos con tabla accesible, exportaciones y análisis avanzado), `reportes-modelo.ts` (rangos, filtros y textos), `reportes-errores.ts`, `api/reportes.ts` (JSON, CSV del servidor y registro previo de PDF y Excel), `gestion/lib/reportes-comun.ts` (modelo de gráficos y descarga compartidos con el demo). Cada exportación queda en Auditoría (`exportacion_reporte`) | `tests/access/reportes.spec.ts` (23 pruebas de reportes: tipos por rol, plan, filtros, CSV, PDF y Excel con registro previo, análisis avanzado y errores) · `tests/componentes/reportes-modelo.test.ts` | 23 de Playwright × 2 perfiles + 39 unitarias | Automatizado (modo conectado). Modo demo, solo en desarrollo: `gestion/lib/reportes.ts`, `gestion/pages/ReportesPage.tsx` (CSV / impresión) · E2E-CU12-REPORTES (`e2e-cu12-reportes.spec.ts`) · 5 (§16.7) |
| CU-13 | Gestionar usuarios y roles | RF-09 | `domain/permisos.ts`, `domain/api/usuarios.ts`, `app/guards.tsx`, `features/admin/*` | E2E-CU13-USUARIOS · unit `permisos-seguridad.spec.ts` | 4 (§16.8) + 22 unitarias | Automatizado |
| CU-14 | Sincronizar datos offline | RF-10 | `domain/sync.ts` (IndexedDB, Last-Write-Wins UTC), `domain/conectividad.ts`, `sistema/pages/Sincronizacion.tsx` | E2E-CU14-SYNC | 4 (§16.9; el conflicto en 2 variantes) + confirmación actualizada al sincronizar | Automatizado |

**Informe médico por adulto mayor** (contrato de la fase 7, ID07; permiso `informe:exportar`: Coordinador y Cuidador con alcance, no el Administrador). No tiene fila propia en la tabla anterior. Modo conectado: `features/access-real/operacion/informe-medico.tsx`, `informe-medico-pdf.ts` e `informe-medico-datos.ts`, con el botón en el seguimiento del expediente (`seguimiento.tsx`). Pruebas: `tests/access/informe-medico.spec.ts` (8 pruebas, con repeticiones por rol y perfil) y `tests/componentes/resumen-informe-datos.test.ts`. Estado: Automatizado (modo conectado).

## 2. Requisitos no funcionales (SRS §8.2.2) cubiertos en el frontend

| Requisito | Cómo se cumple | Verificación |
|---|---|---|
| Accesibilidad / WCAG 2.1 AA | Objetivos táctiles ≥ 48 px en todo el kit, contraste AA (tonos `-700` para texto), `label` en campos, foco visible, «Saltar al contenido», riesgo con color + forma | E2E CU-05/CU-07 (48 px) · revisión visual |
| Adaptabilidad | Mobile-first; bottom-nav en móvil, sidebar compacto en tablet, completo en escritorio | `scripts/smoke.mjs` (360/768/1280, sin scroll horizontal) |
| Auditabilidad / registro de actividades | `domain/auditoria.ts`: quién, qué, registro, fecha y hora, resultado; pantalla de solo lectura para el admin con exportación CSV | E2E CU-13 · CU-14 (conflictos) · unit |
| Documentación | Manual (`docs/MANUAL-USUARIO.md`), ayuda en línea (botón «?» en campos + pantalla Ayuda), README, `.env.example` | revisión |
| Eficiencia / rendimiento | Operaciones locales inmediatas; bundle de 238 KB gzip; precache PWA de 1,3 MB | `npm run build` |
| Espacio / memoria (≤ 50 MB) | Solo la app en caché del Service Worker; cola offline mínima que se borra al sincronizar; medidor en Sincronización | build (1,3 MB) |
| Integridad de datos | Validación en formularios **y** en la capa de servicios (`domain/validacion.ts`, `domain/api/*`); cédula única; relaciones verificadas | E2E CU-02/05/07 |
| Mantenibilidad / reusabilidad | Módulos por responsabilidad, kit UI reutilizable, encabezados por archivo, `docs/AGENTES.md` | `scripts/encabezados.mjs` |
| Robustez | Errores sin detalles técnicos (`ErrorRuta`), borradores que conservan lo escrito (`useBorrador`), avisos claros sin conexión | E2E CU-02 (datos conservados) |
| Usabilidad | Patrones móviles familiares, formulario de visita < 90 s, retroalimentación visual tras cada acción | E2E CU-05 |
| Privacidad (§8.2.2.3.4) | RBAC; familiar limitado a su grupo familiar; datos sensibles ocultos sin `adultos:ver-sensible`; consentimiento informado; anonimización; política de retención e incidentes en Privacidad | E2E CU-04/CU-13 · unit permisos |
| Seguridad (§8.2.2.3.5) | Contraseñas PBKDF2 con sal, política robusta, bloqueo por intentos, recuperación con código de un solo uso, activación de cuentas con código, expiración de sesión, invalidación de cuentas desactivadas, mensajes genéricos, autorización en interfaz **y** servicios | E2E CU-01/CU-13 · unit seguridad |
| Seguridad offline (k) | Cola asociada al usuario autenticado, solo se envía la de ese usuario, se elimina al confirmar | E2E CU-14 |
| Etiquetado (§18) | Logo + usuario y rol en la barra superior, pie de página con copyright e INTEC, «Acerca de», manifiesto con iconos 192/256/512, `package.json` 1.0.0, `LICENSES.md` | revisión |

## 3. Cobertura del modelo de base de datos V3.0

Cada tabla del modelo de BD del equipo tiene representación en el front: tipo en `src/domain/types.ts` y pantalla de captura o consulta. El detalle está en [`MAPEO-BD.md`](MAPEO-BD.md). Verificación:

- **Unitaria:** `tests/unit/permisos-seguridad.spec.ts` comprueba que la semilla cubre todas las tablas, que el alcance va por `Vinculo` y que un vínculo «referente» no da acceso.
- **Unitaria:** `tests/unit/reglas.spec.ts` comprueba el umbral por `Configuracion_Cuenta`, `DetalleVisita` como contacto, `Notificacion` al generar alertas y `Env_Necesidad.Umbral_alerta`.
- **Humo:** `scripts/smoke.mjs` recorre las pantallas nuevas (agenda, suscripción, catálogos, perfil del adulto con contactos, vínculos, riesgos e indicaciones).

## 4. Fuera del alcance de esta entrega (solo frontend)

El usuario decidió entregar **solo el frontend con datos locales**. Por eso los siguientes requisitos del SRS quedan **Pendiente / Bloqueado (sin backend)**: el frontend está preparado para ellos (capa de servicios desacoplada en `src/domain/api`, variables en `.env.example`), pero no pueden verificarse aquí.

| Requisito SRS | Motivo |
|---|---|
| §9.1 Backend Node.js + Express, API REST, Supabase (Auth, base de datos, almacenamiento) | No hay backend en este repositorio; `domain/store.ts` simula el servidor en el navegador. |
| RSUP-01 Respaldos · RSUP-02 Logging del servidor | Responsabilidad del backend y de Supabase. |
| RSUP-04 Pruebas de API (Supertest) y de carga (k6, Perfil B) | Requieren la API. Las pruebas E2E con Playwright sí están implementadas. |
| §8.2.2.1.5/7 Disponibilidad 95 %, MTBF, MTTR · §13.4 HTTPS / puerto 443 / TLS 1.2+ | Dependen del despliegue. |
| Cifrado en reposo y control de acceso en el servidor | Hoy los datos de demostración viven en localStorage del navegador: **no usar con datos reales** hasta conectar el backend. |
| Gestión en Azure DevOps y estados de la RTM en el backlog | Proceso del equipo, no del código. |
