# Contrato de API del Portal Familiar (CR-180)

## Alcance y estado

Propuesta de contrato entre el Portal Familiar del frontend y la API. **El backend solo expone sesión y perfil (fase 1); estos endpoints quedan pendientes de las fases 3 (Envejecientes), 4 (Visitas y seguimiento) y 5 (Necesidades), más las indicaciones médicas.** Hasta entonces el portal funciona en el prototipo local (`/familiar`, solo lectura) y **ninguna función del contrato se monta en la app conectada ni se llama desde el prototipo**.

- Tipos y funciones: `src/features/familiar/lib/contrato-api.ts` (usa `api` y `apiPage` de `@/features/access-real/client`).
- Modelos que consumen las pantallas: `src/features/familiar/lib/modelos.ts`.
- Un hook de datos por pantalla o sección: `src/features/familiar/lib/datos.ts` (hoy lee el store local; mañana llamará a las funciones del contrato).
- Convenciones que se siguen: `CuidaRed-Backend/docs/CONVENCIONES-API.md` (CR-162): base `/api/v1`, rutas en `kebab-case`, campos en `snake_case`, `{ data }` para un recurso, `{ data, meta }` para colecciones, errores `{ error: { code, message }, requestId }`.
- Trazabilidad: Seguridad §4 (acceso por vínculo/permiso y cuenta), Reglas de Negocio V2 §Vínculo (el Familiar solo ve los envejecientes con permiso explícito) y §Indicacion_Medica (consulta sin modificar), RF-09, RF-13, RF-15.

## Regla de autorización (la decide el servidor)

El Familiar solo accede a un envejeciente si tiene **permiso explícito (`familiar_responsable`) sobre él en la cuenta activa**. El cliente nunca decide: ocultar pestañas o rutas es comodidad, no control.

Para cada petición el servidor debe, en este orden:

1. Validar la sesión (`Authorization: Bearer`) y que el usuario esté activo.
2. Resolver la cuenta: en el listado, la de `filter[cuenta_id]`; en los demás endpoints, la `cuenta_id` del envejeciente de la ruta.
3. Comprobar una membresía activa con rol `familiar` en esa cuenta (existe en cuentas Familia y Organización). Un usuario con acceso en dos cuentas solo ve, en cada una, lo autorizado en ella.
4. Comprobar el permiso explícito vigente sobre **cada** envejeciente afectado (vínculo `familiar_responsable`, no revocado). Un vínculo sin permiso no basta (RF-13).
5. Comprobar la prueba o suscripción vigente de la cuenta (D07, ver Pendientes).
6. Comprobar que cada visita, necesidad o indicación de la ruta pertenezca al envejeciente de la ruta. En visitas con varios adultos se devuelve solo lo del envejeciente autorizado.
7. No inferir derechos de nada que envíe el cliente (cuenta, ids, filtros, orden). Rol, actor y permisos no se aceptan como parámetros.

Un envejeciente inexistente, de otra cuenta o sin permiso explícito produce **la misma respuesta 404**, para no revelar si existe. La pantalla muestra "No encontrado o sin permiso".

### Lo que nunca se devuelve

El Familiar no tiene `adultos:ver-sensible`. Ninguna respuesta incluye: nivel o evaluación de riesgo ni historial de riesgos, condición general, consentimiento, situación socioeconómica, observaciones de otros adultos del hogar, alertas ni tareas internas, ni datos de contacto del personal (solo nombre y apellido). De un visitante externo autorizado solo se envía su nombre: cédula, teléfono y correo no salen, y por eso `notas` es siempre `null` en las visitas de visitante externo (en la creación local esas notas guardan su cédula y teléfono).

## Cuenta activa

La persona puede tener acceso en varias cuentas. El transporte de la cuenta activa **no está confirmado en el backend** (CONTEXTO-BACKEND §6.3). Propuesta:

- Listado: `filter[cuenta_id]=<uuid>` obligatorio (422 si falta; 403 si la persona no es Familiar activo en esa cuenta, sin distinguir cuenta inexistente de cuenta ajena). Es una igualdad del contrato inicial, no una consulta ejecutable.
- Recursos por id: la cuenta se deduce del envejeciente; no se envía.

## Endpoints

Todos son `GET`, de solo lectura, y requieren sesión. Prefijo `/api/v1/familiar/envejecientes`.

| Endpoint | Respuesta | Pantalla (hook) |
| --- | --- | --- |
| `GET /` | `{ data: EnvejecienteResumenDto[], meta }` | Mis envejecientes (`useEnvejecientesFamiliar`) |
| `GET /:id` | `{ data: EnvejecienteDetalleDto }` | Perfil de solo lectura (`useEnvejecienteFamiliar`) |
| `GET /:id/visitas` | `{ data: VisitaResumenDto[], meta }` | Pestaña Visitas (`useVisitasFamiliar`) |
| `GET /:id/visitas/:visitaId` | `{ data: VisitaDetalleDto }` | Detalle de visita (`useVisitaFamiliar`) |
| `GET /:id/necesidades` | `{ data: NecesidadResumenDto[], meta }` | Pestaña Necesidades (`useNecesidadesFamiliar`) |
| `GET /:id/necesidades/:necesidadId` | `{ data: NecesidadDetalleDto }` | Detalle de necesidad (`useNecesidadFamiliar`) |
| `GET /:id/indicaciones` | `{ data: IndicacionDto[], meta }` | Pestaña Indicaciones (`useIndicacionesFamiliar`) |

Los dos detalles (`visitas/:visitaId`, `necesidades/:necesidadId`) son adicionales a los cinco endpoints previstos: las pantallas de detalle los necesitan y así la autorización del envejeciente se comprueba una sola vez en la ruta.

### Paginación, orden y filtros

Paginación acordada: `page` (desde 1, predeterminado 1) y `limit` (1 a 100, predeterminado 20). `meta` = `{ page, limit, total, totalPages }`; `total` cuenta solo registros autorizados que cumplen los filtros. Orden: `sort=-campo,campo`. Filtros: `filter[campo]=valor` (igualdad). Parámetros desconocidos, repetidos o inválidos: 422.

| Endpoint | `sort` permitido | Orden predeterminado (desempate) | `filter[…]` |
| --- | --- | --- | --- |
| `/` | `dias_sin_contacto`, `apellidos`, `nombres` | `-dias_sin_contacto,apellidos,nombres` (`envejeciente_id`) | `cuenta_id` (uuid, obligatorio); `estado` = `activo` \| `inactivo` (predeterminado `activo`) |
| `/:id/visitas` | `fecha`, `hora_pautada` | `-fecha,-hora_pautada` (`visita_id`) | `estado` = `pendiente` \| `en_curso` \| `completada` \| `cancelada` |
| `/:id/necesidades` | `abierta`, `fecha_registro`, `prioridad` | `-abierta,-fecha_registro` (`necesidad_id`) | `abierta` = `true` \| `false` (pendiente o en proceso); `estado`; `tipo` |
| `/:id/indicaciones` | `fecha_inicio`, `estado` | `-fecha_inicio` (`indicacion_id`) | `estado` = `vigente` \| `suspendida` \| `finalizada` (predeterminado `vigente`) |

- `abierta` es un campo derivado (`estado` en `pendiente` o `en_proceso`) que el servidor declara como ordenable y filtrable.
- No hay búsqueda por nombre: las convenciones exigen definir antes cualquier búsqueda. Mientras tanto el cliente filtra la lista ya cargada (el listado de una familia es corto: se pide con `limit=100`).
- Las visitas incluyen las compartidas con otros adultos del hogar (el envejeciente aparece como adulto adicional).

### Ejemplos

`GET /api/v1/familiar/envejecientes?page=1&limit=100&filter[cuenta_id]=…&filter[estado]=activo`

```json
{
  "data": [
    {
      "envejeciente_id": "…",
      "cuenta_id": "…",
      "nombres": "Elena",
      "apellidos": "Rodríguez",
      "fecha_nacimiento": "1950-10-18",
      "estado": "activo",
      "tipo_vinculo": "familiar_responsable",
      "seguimiento": {
        "dias_sin_contacto": 1,
        "con_visitas": true,
        "seguimiento_atrasado": false,
        "ultima_visita": {
          "visita_id": "…", "fecha": "2026-11-05", "hora_pautada": "16:30", "hora_inicio": "2026-11-05T20:35:00Z",
          "estado": "completada", "razon": null, "tipo": "Visita de Seguimiento",
          "responsable": { "nombres": "Carlos", "apellidos": "Pérez" }, "visitante_nombre": null,
          "es_compartida": false, "estado_adulto": "estable", "observacion": "Se encuentra de buen ánimo."
        },
        "proxima_visita": null,
        "necesidades_abiertas_total": 1
      },
      "necesidades_abiertas": []
    }
  ],
  "meta": { "page": 1, "limit": 100, "total": 1, "totalPages": 1 }
}
```

`GET /api/v1/familiar/envejecientes/:id` devuelve datos básicos (`nombres`, `apellidos`, `fecha_nacimiento`, `cedula`, `sexo`, `telefono`, `direccion`, `sector`, `municipio`, `provincia`, `fecha_registro`), `contactos_emergencia`, `cuidadores` y `voluntarios` (solo `{ nombres, apellidos }`), `seguimiento` y `permisos.indicaciones_ver` (ayuda para mostrar la pestaña; el servidor vuelve a comprobar el permiso en `/indicaciones`).

Los campos exactos de cada DTO están tipados en `contrato-api.ts`; las visitas externas llevan `visitante_nombre` y `notas: null`.

## Errores

Cuerpo según CR-162: `{ "error": { "code": "…", "message": "…" }, "requestId": "…" }`, con `X-Request-Id`. Sin SQL, stack, detalles técnicos ni datos de otra persona.

| HTTP | Código | Cuándo | Qué hace el frontend |
| --- | --- | --- | --- |
| 401 | `UNAUTHORIZED` / `INVALID_SESSION` | Sin sesión o token inválido | Pide iniciar sesión de nuevo (lo resuelve la sesión conectada) |
| 403 | `FORBIDDEN` | La persona no es Familiar activo en la cuenta pedida, o no tiene `indicaciones:ver` | Pantalla "No encontrado o sin permiso"; no cierra la sesión |
| 403 | `USER_INACTIVE` | Usuario desactivado | Revoca la sesión local |
| 404 | `NOT_FOUND` | El envejeciente (o su visita, necesidad o indicación) no existe, es de otra cuenta o no está autorizado. Misma respuesta en los tres casos | "No encontrado o sin permiso", sin filtrar datos |
| 422 | `INVALID_INPUT` | `filter[cuenta_id]` ausente, parámetro desconocido, repetido o inválido | Mensaje genérico; no debería ocurrir con las funciones tipadas |
| 503 | `DEPENDENCY_UNAVAILABLE` | Dependencia o contrato de persistencia no disponible | "No se pudo cargar la información" y reintento |

`consultaDesdeError` (en `contrato-api.ts`) traduce estos casos al estado de consulta de las pantallas: 403 y 404 se muestran igual; 401 y `USER_INACTIVE` no se ocultan.

## Correspondencia DTO → modelo de vista

| DTO (`contrato-api.ts`) | Modelo (`modelos.ts`) | Notas |
| --- | --- | --- |
| `EnvejecienteResumenDto` | `EnvejecienteTarjeta` | `nombres + apellidos` → `nombre`; `fecha_nacimiento` → `edad`; `tipo_vinculo` → etiqueta "Familiar responsable" |
| `EnvejecienteDetalleDto` | `EnvejecientePerfil` | `contactos_emergencia` → `contactos`; `cuidadores`/`voluntarios` → listas de nombres; `permisos.indicaciones_ver` → `permisos.indicaciones` |
| `SeguimientoDto` | `SeguimientoVista` | `dias_sin_contacto`, `con_visitas`, `seguimiento_atrasado`, `ultima_visita`, `proxima_visita`, `necesidades_abiertas_total` |
| `VisitaResumenDto` / `VisitaDetalleDto` | `VisitaResumenVista` / `VisitaDetalleVista` | `es_compartida` → `compartida`; `aspectos_verificados` → `checklist`; `evidencias[].es_imagen/url` → `evidencias[].imagen` |
| `NecesidadResumenDto` / `NecesidadDetalleDto` | `NecesidadVista` / `NecesidadDetalleVista` | `fecha_registro` → `creadaEn`; `fecha_resolucion` → `resueltaEn`; `actor: null` → "Sistema" |
| `IndicacionDto` | `IndicacionVista` | `evidencia_nombre` → `respaldo` |

## Cómo conectar (cuando existan los endpoints)

1. En cada hook de `lib/datos.ts`, obtener el token de la sesión conectada y llamar a la función del contrato (`listarEnvejecientes`, `obtenerEnvejeciente`, `listarVisitas`, `obtenerVisita`, `listarNecesidades`, `obtenerNecesidad`, `listarIndicaciones`).
2. Convertir el DTO al modelo de `modelos.ts` y devolver `Consulta<T>`: `cargando` mientras responde, `listo` con los datos y `error` con `consultaDesdeError`. Las pantallas ya manejan los tres estados (`SinDatos`).
3. Quitar del hook la lectura del store local. Las pantallas no cambian.
4. Añadir pruebas de contrato junto a `tests/access/api-contract.spec.ts` (móvil y escritorio) y casos de autorización: familiar con permiso, sin permiso, tras revocarlo, y con acceso en dos cuentas.

## Pendientes y decisiones abiertas

- **Fases 3–5 del backend**: los endpoints no existen. Este documento es la propuesta del frontend para revisarla con backend.
- **Permiso explícito del Familiar (D04)**: cómo se persiste, su vigencia y su revocación. Hasta definirlo se usa el vínculo `familiar_responsable` como equivalente.
- **Transporte de la cuenta activa (D04/D08)**: se propone `filter[cuenta_id]` solo en el listado; pendiente de confirmar con el selector de cuenta del backend.
- **Suscripción vencida (D07)**: al vencer sin pago se bloquea también la consulta. Falta el código de error; no se inventa uno mientras backend no lo apruebe.
- **Detalles anidados**: las rutas del portal (`/familiar/visitas/:visitaId`, `/familiar/necesidades/:necesidadId`) llevan `?adulto=` porque la API cuelga los detalles del envejeciente. Un enlace sin `?adulto=` necesitará resolver el envejeciente antes de llamar a la API.
- **Paginación en pantalla**: el listado pide `limit=100`; las pestañas necesitarán "Ver más" si superan la primera página.
- **Evidencias**: hoy el prototipo guarda el nombre o una miniatura. Con la API serían URL firmadas de vida corta, aún sin definir.
- **Auditoría de lecturas**: decidir si se registran las consultas de datos de salud y los intentos denegados (Ley 42-01).
