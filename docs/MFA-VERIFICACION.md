# Verificación: autenticación multifactor (MFA)

Punto del feedback de la subtarea **LOGIN SCREEN**: "Verificar la agregación de autenticación multifactor".

## Resultado

Es viable con lo que ya usa el proyecto. Supabase Auth trae MFA con TOTP (app de autenticación como Google Authenticator o Microsoft Authenticator) en el mismo SDK `@supabase/supabase-js` que usa el acceso conectado. No hace falta otra librería.

Flujo en el cliente:

1. **Inscripción** (desde Mi cuenta): `auth.mfa.enroll({ factorType: 'totp' })` devuelve el QR y el secreto. La persona escanea y confirma con `auth.mfa.challenge` + `auth.mfa.verify` usando el código de 6 dígitos.
2. **Inicio de sesión**: después de `signInWithPassword`, `auth.mfa.getAuthenticatorAssuranceLevel()` indica si la sesión necesita subir de `aal1` a `aal2`. Si es así, se pide el código y se verifica igual que arriba.
3. **Recuperación**: si se pierde el dispositivo, un administrador de Supabase puede quitar el factor; conviene ofrecer dos factores por persona.

## Qué falta para activarlo

- **Configuración de Supabase Auth**: habilitar MFA TOTP en el proyecto. Es un cambio de configuración Auth, que según `AGENTS.md` del backend requiere aprobación previa.
- **Backend**: para que sea obligatorio de verdad, la API debe rechazar operaciones de roles con datos sensibles (Administrador y Coordinador) cuando el JWT no tenga `aal = aal2`. Hoy `api_sesion` no lo revisa; cambiarlo es un cambio de BD/RPC con aprobación.
- **Front**: pantalla de inscripción en Mi cuenta y paso de código después del login en `src/features/access-real`. Es poco código, pero no se puede probar contra el proyecto real hasta que exista la configuración, así que no se dejó a medias.

## Recomendación

Opcional para todos los roles y obligatorio para Administrador y Coordinador, que gestionan miembros y datos sensibles de adultos mayores (Ley 172-13). Se implementa en cuanto el equipo apruebe la configuración Auth y el control `aal2` en el backend.

Referencia: documentación de Supabase, "Multi-Factor Authentication (TOTP)".
