# Flujo de Login y Perfil (acceso conectado)

Diagramas de secuencia de los módulos de **Login** y **Perfil**, en el mismo formato que el de invitación de la tarea "Verificar Desarrollo FrontEnd". Reflejan el código actual: `src/features/access-real/*` (front) y `src/modules/access/*` del backend. Imágenes: `login.png` y `perfil.png` en esta carpeta.

## 1. Inicio de sesión y cuenta activa

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario (cualquier rol)
  participant F as Frontend (/inicio, /cuenta)
  participant A as Supabase Auth
  participant E as Backend Express (/api/v1)
  participant P as PostgreSQL (cuidared)
  U->>F: Correo y contraseña en /inicio
  F->>A: signInWithPassword()
  A-->>F: JWT (access + refresh token), guardado en sessionStorage
  F->>E: GET /api/v1/me (Bearer token)
  E->>A: Valida el token (getUser)
  E->>P: api_sesion('validar') + api_mi_perfil()
  P-->>E: Identidad, perfil y cuentas con rol (CR-164)
  E-->>F: { data: identity, profile, cuentas }
  F->>F: Elige la cuenta activa y redirige según el rol (/admin, /coordinador, /cuidador, /familiar, /voluntario)
  Note over F,A: El SDK renueva el token solo (autoRefreshToken) y recargar la página conserva la sesión
```

## 2. Perfil, actividad y cierre de sesión

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuario
  participant F as Frontend (Mi perfil)
  participant A as Supabase Auth
  participant E as Backend Express (/api/v1)
  participant P as PostgreSQL (cuidared)
  U->>F: Edita nombres, apellidos o teléfono
  F->>E: PATCH /api/v1/me
  E->>P: api_actualizar_mi_perfil()
  P-->>E: Perfil actualizado
  E-->>F: { data: perfil } y mensaje de éxito
  U->>F: Cambia de cuenta (si tiene varias)
  F->>E: GET /api/v1/me
  E-->>F: Permisos y plan de la cuenta elegida
  loop Cada interacción (máximo 1 por minuto)
    F->>E: POST /session/activity
    E->>P: api_sesion('actividad')
    P-->>E: Vigente, o vencida (30 min sin uso / 12 h)
  end
  alt Sesión vencida
    E-->>F: 401 INVALID_SESSION
    F->>A: signOut (local) y vuelve a /inicio
  end
  U->>F: Cerrar sesión
  F->>E: POST /session/logout
  E->>P: api_sesion('cerrar')
  F->>A: signOut()
  F-->>U: Redirige a /inicio
```
