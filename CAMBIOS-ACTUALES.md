# Cambios actuales

## 07/11/2026 — Integración de fases 2 a 4

- Perfil y autenticación independientes de cuentas e invitaciones. Listado CR-162, vigencia de la prueba, datos de cuenta y gestión según el rol confirmado por la API.
- Desde **Mi cuenta → Abrir cuenta** se accede al portal conectado de expedientes, visitas y agenda. Los recorridos usan las API reales y el bucket privado para evidencias.
- La captura offline de visitas autorizadas permanece en memoria durante la sesión de la pestaña. Se reintenta al volver la conexión. Las solicitudes externas siguen separadas y sin acceso público.
- Verificar con `npm run typecheck`, `npm run build` y `npm run test:access`. Los recorridos de navegador simulan Auth y API.
