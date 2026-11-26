# Mejoras de vistas de la PWA · 25/11/2026

## Activar cuenta

El correo y el código de invitación se presentan en filas de igual ancho. Las contraseñas también se muestran en una columna; los datos personales conservan la rejilla adaptable. El último paso resume las mismas reglas de contraseña que valida el cliente, para evitar un formulario innecesariamente alto. Se mantienen la verificación de la invitación, el perfil previamente registrado, la cédula de solo lectura, la aceptación legal y la activación mediante la sesión verificada.

## Visitas y agenda

- El calendario del equipo ofrece vistas **Día** y **Semana**, navegación por fechas, una cuadrícula horaria y citas con color, icono y estado. Las citas simultáneas se distribuyen en carriles. Cada cita abre el detalle de visita existente.
- Se consultan las visitas del período seleccionado con los filtros y la paginación del endpoint existente. No se inventa disponibilidad; las comprobaciones y autorizaciones siguen en el servidor.
- El formulario de programación conserva su consulta diaria de disponibilidad. La vista de calendario del equipo no sustituye esa validación.
- La agenda ofrece **Listado** y **Tablero**. Ambos usan las mismas tareas, filtros y paginación. El tablero agrupa por pendiente, en progreso, completada y cancelada; sus contadores corresponden a la página mostrada.
- Los filtros se pueden desplegar en el tablero. Abrir una tarea conserva las acciones existentes de inicio, edición, cancelación, finalización y evidencias según los permisos.
- El tablero no modifica estados mediante arrastre: las validaciones y las evidencias siguen formando parte de los formularios actuales.

## Marco y navegación

Miembros se renderiza dentro del marco operativo cuando se abre desde `/operacion/:cuentaId/miembros`. La lista, las invitaciones, el detalle, la gestión de roles y el contacto con soporte mantienen sus componentes y acciones. La entrada independiente desde el perfil conserva su navegación de regreso.

Solicitudes se agrupa bajo Visitas y Resumen bajo Reportes. Cada grupo se puede desplegar o contraer. La agrupación no concede permisos: si una persona solo tiene permiso para el módulo secundario, el padre se presenta como una categoría desplegable y no como un acceso a un módulo prohibido. Los enlaces directos existentes se conservan.

## Perfil

La vista inicial muestra datos reales de la persona, su rol y cuenta activa, información personal y cuentas vinculadas. **Editar perfil** abre el formulario existente. Los accesos a Abrir cuenta y Miembros permanecen visibles cuando están permitidos; el detalle de suscripción se puede desplegar.

Seguridad y privacidad enlaza a la recuperación de contraseña y las páginas legales existentes. El texto explica que la recuperación utiliza un código por correo; no promete una comprobación de contraseña actual que ese flujo no tiene implementada. Cerrar sesión mantiene su operación original.

## Notificaciones

Los avisos se agrupan por fecha, con filtros Todas, Sin leer y Leídas, contadores del servidor y diferenciación de avisos pendientes de lectura. Abrir un aviso con alerta asociada marca su lectura mediante el endpoint existente y abre esa alerta. También se conserva la acción de marcar como leído sin abrir el detalle, su fecha de lectura y la configuración de avisos del dispositivo.

**Alcance actual del backend:** esta bandeja consume `/notificaciones-alerta`. Las notificaciones generales de visitas, solicitudes o invitaciones que aparecen en la referencia gráfica necesitan un contrato adicional del backend; no se muestran registros simulados ni acciones para eventos que la API no entrega. Tampoco se añade una acción de lectura masiva sin un endpoint que la respalde.

## Verificación

`tests/access/mejoras-vistas.spec.ts` comprueba la alineación de la activación, el marco de Miembros, los submenús, las citas simultáneas, la apertura del detalle desde el calendario, el tablero, la consulta/edición del perfil y la lectura de avisos con servicios interceptados. Genera capturas en móvil y escritorio sin utilizar cuentas ni datos personales reales.

Las pruebas existentes mantienen la comprobación de las operaciones y permisos. Sus pasos se adaptan a **Editar perfil**, al título **Mi perfil** y al desplegable **Suscripción y acceso**. La compilación conserva el Service Worker y los recursos autoalojados de la PWA; no se agregan dependencias ni variables de entorno para estas mejoras.

Resultado final: **383 pruebas de navegador aprobadas y 1 omitida** (teclado móvil en el proyecto de escritorio); **168 pruebas de componentes aprobadas**. La compilación de producción incluye la revisión de tipos. El precache pesa **2,63 MB de 50 MB**. El navegador abrió `/` y `/inicio` sin conexión y confirmó que la API no se sirve desde Cache Storage. Lint finaliza sin errores, con los avisos ya presentes de exportaciones compartidas, código generado y otras áreas del proyecto.
