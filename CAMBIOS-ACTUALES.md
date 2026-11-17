# Cambios actuales

## 17/11/2026 — Acceso al abrir una notificación

- `src/features/access-real/` recupera la sesión vigente mediante una cookie protegida y vuelve a la bandeja al abrir un aviso desde otra pestaña. El cierre manual borra la cookie y revoca los avisos del navegador.
- Las pruebas de acceso verificaron en móvil y escritorio recuperar la sesión después de cerrar la pestaña, volver a iniciar sesión si vence y mantener el destino de la notificación.

## 17/11/2026 — Prueba local de Web Push

- `npm run dev:web-push` habilita el service worker en `localhost` para probar la entrega real con la API local. El desarrollo normal mantiene su configuración.

## 16/11/2026 — Entrega Web Push y cierre de sesión

- El worker agrupa repeticiones del mismo aviso mediante su UUID. La sesión vencida por inactividad conserva la suscripción. Cerrar sesión manualmente retira la suscripción de ese navegador y se comprueba la propiedad al volver a iniciar sesión.

## 16/11/2026 — Inicio de Web Push

- La bandeja de notificaciones integra la activación y desactivación voluntarias por dispositivo mediante el contrato de Web Push. Las suscripciones existentes se pueden desactivar mientras el envío esté pausado.
- La PWA conserva la caché y agrega el manejo de avisos genéricos del sistema. Al tocar un aviso, la bandeja de esa cuenta se abre por una ruta protegida y conserva el destino si es necesario iniciar sesión.
- Pasaron la compilación de producción, la validación de caché y las pruebas del worker y de suscripción simulada en móvil y escritorio.

## 15/11/2026 — Indicador de notificaciones

- La cabecera del portal muestra una campana con la cantidad de avisos personales sin leer y abre directamente su bandeja. El contador usa los permisos y la cuenta activa, se actualiza al marcar un aviso como leído y se consulta cada 30 segundos mientras la pestaña está visible.

## 15/11/2026 — Asignación de cuidadores desde Envejecientes

- Los gestores con permiso pueden abrir **Asignar cuidador** desde las acciones rápidas de un expediente activo. En Familia se muestra el selector de cuidadores y en Organización sigue disponible la asignación de voluntarios.
- Cuando no hay candidatos elegibles, el formulario explica cómo habilitar al cuidador y ofrece ir a Miembros a quienes tienen permiso.

## 15/11/2026 — Titularidad en Configuración

- La transferencia de titularidad se movió de Inicio a Configuración. Se mantiene el acceso del titular autorizado y la confirmación del nuevo titular.

## 15/11/2026 — Corrección del formulario de Necesidades

- El selector de Responsable y el de Indicación médica mantienen identidades distintas por expediente. Al registrar una necesidad solo aparece un campo de cada tipo y se conserva la selección al editar la cantidad.
- La unidad aparece junto a la cantidad y se exige si se llena ese campo. Si se intenta enviar con una unidad pendiente, se abren los datos opcionales para que el campo sea visible.
- El cliente muestra un mensaje en español cuando se pierde la conexión con la API. Si el registro queda sin confirmación, el formulario conserva los datos y no reenvía la solicitud automáticamente.

## 15/11/2026 — Revisión de Necesidades y Alertas

- `operacion/necesidades.tsx` bloquea cambios en expedientes inactivos y evita recuperar un detalle de la lista tras un rechazo del servidor. La captura sin conexión conserva la versión de origen para resolver conflictos.
- `operacion/cola-operaciones.ts` conserva las operaciones sin confirmación válida. Informa cuando se agotó el cupo del plan y reintenta con el mismo identificador de operación, por cuenta y módulo.
- `operacion/alertas.tsx` presenta la fuente, la fecha de lectura, quién atendió la alerta y si el cierre fue automático. Conserva el filtro y la página al regresar del detalle. Los filtros coinciden con los estados de la API.
- Los detalles y formularios gestionan el foco al abrir y volver. Las pruebas Playwright cubren navegación móvil a 320 px, lectura de avisos, atención y resolución de alertas, y sincronización de altas y cierres.
- Verificación local con compilación de producción y 116 recorridos Playwright del portal con Auth y API simulados. La regresión de alta offline comprueba que el reintento conserva el decimal `0.004` y una unidad de 64 caracteres.

## 15/11/2026 — Necesidades y Alertas

- El portal incluye **Necesidades** para consultar ocurrencias abiertas, registrar, priorizar, asignar responsables y gestionar el estado según permisos. El expediente muestra la lista e historial asociados.
- La cola en memoria de la pestaña permite registrar necesidades y cambiar su estado con los expedientes y catálogos ya consultados. Al recuperar conexión se muestran rechazos y conflictos.
- **Alertas** agrupa casos prioritarios por adulto, conserva los detalles y abre una bandeja de avisos con lectura individual. Los controles de atención y resolución siguen los permisos de cuenta.
- Validación local: compilación, 113 pruebas de componentes y 112 recorridos de navegador con la API simulada. La captura de necesidades se verificó en móvil y escritorio.

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
