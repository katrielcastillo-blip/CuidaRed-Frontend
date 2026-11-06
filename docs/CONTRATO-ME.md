# Contrato propuesto de `GET /api/v1/me` con cuentas y roles (CR-164 → CR-175)

Lo que el frontend conectado ya sabe leer de `/me` para el contexto de cuenta y rol activo. Hoy el backend (fase 1) devuelve solo `identity` y `profile`; los campos nuevos son opcionales y la app funciona sin ellos. Convenciones de CR-162: `snake_case`, `{ "data": ... }`, errores públicos, sin paginar `/me`.

```json
{
  "data": {
    "identity": { "id": "uuid", "email": "ana@correo.do" },
    "profile": { "id": "uuid", "cedula": "00112345678", "nombres": "Ana", "apellidos": "Pérez", "correo": "ana@correo.do", "telefono": null, "estado": "activo" },
    "cuenta_activa_id": "uuid-cuenta",
    "cuentas": [
      {
        "cuenta_id": "uuid-cuenta",
        "nombre": "Fundación Esperanza",
        "tipo": "organizacion",
        "rol": "cuidador",
        "estado_membresia": "activa",
        "permisos": ["adultos:ver", "visitas:registrar", "necesidades:registrar"],
        "estado_suscripcion": "activa",
        "funcionalidades": ["registro_visitas", "necesidades_diarias"],
        "es_titular": false
      }
    ]
  }
}
```

| Campo | Regla |
|---|---|
| `tipo` | `familia` u `organizacion` (Reglas de Negocio V2). |
| `rol` | `administrador` (solo Organización), `coordinador`, `cuidador`, `familiar`, `voluntario` (solo Organización). |
| `permisos` | Acciones efectivas del rol en esa cuenta. El catálogo de acciones del front está en `src/domain/permisos.ts` (`Accion`); en Familia el Coordinador suma la gestión de accesos. |
| `estado_suscripcion` / `funcionalidades` | Para el control de funcionalidades por plan (CR-157 / CR-187). Prueba gratuita de 7 días a nivel de cuenta. |
| `cuentas` | Incluir membresías inactivas solo si se quiere mostrar historial; el front filtra `estado_membresia = "activa"`. |

**Cuenta activa.** El front recuerda la cuenta elegida en `sessionStorage` (`cuidared.cuenta.activa`) y vuelve a consultar `/me` al cambiarla. No la envía como parámetro de autorización: falta acordar con backend cómo se indica la cuenta en los endpoints de las fases 2 a 8 (ruta `/cuentas/:id/...` o cabecera). Si se usa cabecera, debe permitirse en CORS antes de que el front la envíe.

Implementación en el front: `src/features/access-real/cuentas.tsx` y tipos `CuentaMe` / `CurrentUser` en `client.ts`. Pruebas: `tests/access/cuentas.spec.ts`.
