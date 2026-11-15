# Cambios actuales

## 13/11/2026 — Correcciones de las fases 2 a 4

- `src/features/access-real/`: Inicio recupera la cuenta elegida aunque quede fuera de la página actual. Miembros permite reenviar una invitación y la edición del Cuidador puede conservar su empleador global.
- `operacion/`: conservar el tipo al editar una indicación, abrir adjuntos privados, retirar el consentimiento y consultar la constancia. Auditoría y solicitudes de visita se muestran según el permiso de la cuenta.
- Preparar series autorizadas desde **Programar visita** cuando el plan lo permite. Se pueden abrir desde el listado las capturas autorizadas que están en memoria al perder la conexión. El reintento queda limitado a la cuenta activa.
- Validación local con compilación, 113 pruebas de componentes y 104 recorridos Playwright con Auth y API simulados. Se volvió a comprobar en móvil y escritorio la bandeja con selección de responsable.

## 09/11/2026 — Interfaz conectada de las fases 2 a 4

- Al iniciar sesión se abre el Inicio de la cuenta activa. Si no hay cuenta disponible, Inicio muestra las opciones de cuenta e invitaciones. El perfil se edita desde **Mi cuenta**.
- Se distingue el correo del perfil, el logotipo lateral abre Inicio y el botón Volver solo aparece en las pantallas interiores. Se alinean la flecha de configuración y las tarjetas de Inicio y Más. Los filtros de envejecientes se apilan en móvil para mostrar la opción completa.
- El registro distingue la creación de una cuenta Familia u Organización de la activación por invitación. **Miembros → Agregar miembro** permite elegir el rol autorizado, incluido Cuidador, y separa la invitación del listado y del perfil.
- El formulario muestra un solo aviso si las invitaciones a personas nuevas no están habilitadas.
- La navegación operativa usa barra inferior en móvil y menú lateral en escritorio. Configuración de cuenta utiliza catálogos dependientes de provincia y municipio, campos numéricos e interruptores según el tipo de preferencia.
- El registro de adultos se divide en datos personales, ubicación y contacto con consentimiento. El expediente separa el historial, el riesgo, las indicaciones y los permisos.
- El selector de personas en Asignaciones ocupa el ancho disponible para que se lean el nombre y el rol.
- Visitas separa hoy, próximas e historial. Agenda distingue listado, detalle y edición, y muestra una vista previa de la recurrencia. Ambos flujos conservan las reglas de autorización y acceso a evidencias privadas.
- Los catálogos locales y el cálculo de recurrencias se reutilizan sin cargar el almacén del prototipo en el acceso conectado.
- Verificación local: compilación de producción, 113 pruebas de componentes y 100 casos de navegador en móvil y escritorio con servicios simulados.

## 07/11/2026 — Integración de fases 2 a 4

- Perfil y autenticación independientes de cuentas e invitaciones. Listado CR-162, vigencia de la prueba, datos de cuenta y gestión según el rol confirmado por la API.
- Desde **Mi cuenta → Abrir cuenta** se accede al portal conectado de expedientes, visitas y agenda. Los recorridos usan las API reales y el bucket privado para evidencias.
- La captura offline de visitas autorizadas permanece en memoria durante la sesión de la pestaña. Se reintenta al volver la conexión. Las solicitudes externas siguen separadas y sin acceso público.
- Verificar con `npm run typecheck`, `npm run build` y `npm run test:access`. Los recorridos de navegador simulan Auth y API.
