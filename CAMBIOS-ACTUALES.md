# Cambios actuales

## 25/11/2026 — Activación, calendario, tareas y navegación integrada

- Activación con correo/código y contraseñas alineados, conservando la verificación y los datos de la invitación.
- Calendario de visitas por día/semana, con carriles para citas simultáneas; agenda con listado y tablero sobre los registros y filtros existentes.
- Miembros dentro del marco operativo, sin perder el menú. Solicitudes se agrupa bajo Visitas y Resumen bajo Reportes, respetando los permisos de cada módulo.
- Perfil de consulta con edición explícita y accesos reales de seguridad; avisos de alertas agrupados por fecha con filtros, contadores y lectura.
- Alcance de la API y validación documentados en `docs/MEJORAS-VISTAS-PWA.md`. No se crean notificaciones ficticias de otros módulos.
- Validación final: 383 pruebas de navegador y 168 de componentes aprobadas; 1 omisión de teclado móvil en escritorio. Compilación, comprobación de tipos y arranque sin conexión correctos. Precache PWA: 2,63 MB.

## 25/11/2026 — Rediseño visual de la PWA

- Inicio operativo con identidad de la cuenta, datos reales, indicadores por permiso, pendientes y casos prioritarios; se conservan los módulos y acciones existentes. Familias no recibe funciones de visitas.
- Sistema visual compartido con Montserrat/Open Sans autoalojadas, Material Symbols optimizados, superficies blancas, contrastes y tipografía legible. Se adaptan perfil y expedientes a móvil y escritorio.
- Ayuda flotante con seis opciones de diseño deshabilitadas: aprendizaje, preguntas frecuentes, idioma, soporte, modo claro/oscuro y accesibilidad. Únicamente abrir y cerrar el panel tiene comportamiento.
- Decisiones, límites de consulta de Figma y validación documentados en `docs/REDISENO-PWA.md`. Sin cambios de contratos HTTP, base de datos ni variables privadas.
- Verificación: 371 pruebas de navegador correctas y 1 omitida; 168 de componentes correctas. Los retoques finales pasan además 42 pruebas de operación/rediseño y 10 comprobaciones del diseño final. Compilación, arranque sin conexión y caché PWA (2,61 MB) correctos.

## 25/11/2026 — Integración reciente y preparación del PR de visitas

- Actualizada la base desde `origin/Integracion` hasta `bbe2ff4`, con suscripciones y pagos de prueba. El formulario compartido conserva los nuevos controles y el tamaño de acciones de visitas; la ayuda de pruebas conserva la lectura de origen de la versión remota.
- Se restauraron visitas, acceso móvil, identidad visual, soporte e imágenes desde el respaldo local. El PR de visitas selecciona solo sus pantallas, validaciones, pruebas y documentación; los demás cambios siguen conservados localmente. El entorno privado no se modifica.
- Verificación: 168 pruebas de componentes, 88 pruebas de navegador de visitas/operación/suscripciones en móvil y escritorio, compilación y caché de PWA correctas (2,62 MB). La copia exacta del PR también se comprueba por tipos. No se envían correos ni se procesan pagos reales.

## 25/11/2026 — Revisión de suscripciones y pagos

- En `src/features/access-real/operacion/suscripcion.tsx`, las tarjetas muestran los términos de un pago iniciado, distinguen la oferta nueva del contrato vigente y permiten actualizar los planes. Los mensajes de cotización y pago aparecen junto a su oferta y las acciones esperan a que termine la actualización de los datos.
- La vista explica cómo retomar un pago al salir de Stripe y cómo proceder ante un intento vencido. El estado y los cupos usan etiquetas accesibles y un diseño adaptable a pantallas estrechas.
- Pasaron las 36 pruebas de Suscripción con servicios simulados en móvil y escritorio. También pasaron la comprobación de tipos, el lint de los archivos modificados y la compilación de producción.

## 24/11/2026 — Contratación de planes de Organización

- `src/features/access-real/operacion/suscripcion.tsx` ofrece Operación Base por tarifa publicada y muestra precio y cupos por ciclo para Gestión Comunitaria Avanzada. CuidaRed envía la versión revisada y refresca los términos si la cotización cambió.
- Pasaron 30 pruebas de Suscripción en móvil y escritorio con servicios simulados y la comprobación de tipos.

## 24/11/2026 — Reportes avanzados en Cuidado Integral

- La pantalla de Suscripción muestra «Análisis avanzado y exportación a Excel» cuando la funcionalidad figura en el catálogo del servidor. Las pruebas de Reportes cubren la descarga de Excel en Cuidado Integral y la exclusión de Visitas en Familia.
- Pasaron ocho pruebas de Reportes y Suscripción en móvil y escritorio, además de la comprobación de tipos.

## 22/11/2026 — Catálogo dinámico de planes

- Suscripción consulta límites, beneficios y precios de referencia desde la API en `suscripcion.tsx`. La pantalla vuelve a consultar al recuperar visibilidad y cada 30 segundos mientras permanece visible.
- Básico Familiar muestra el cupo de cuidadores configurado en Backoffice. Cuidado Integral muestra cuidadores sin límite. El selector de periodicidad conserva su selección durante la actualización.
- Pasaron las 28 pruebas de Suscripción en móvil y escritorio y la compilación de producción.

## 22/11/2026 — Fase 8 · Suscripción y pagos de prueba

- El resumen de la cuenta y el aviso de plan de Reportes abren Suscripción y pagos. La vista conserva el acceso de los roles autorizados cuando la cuenta vence.
- La vista consulta ofertas compatibles y el historial paginado. Solo la persona titular puede iniciar Stripe Checkout en Sandbox. El retorno consulta el estado del servidor y reconoce los pagos que CuidaRed ya recibió de Stripe.
- La persona titular puede retomar Checkout, solicitar una cotización de Organización, confirmar un cambio de plan o cancelar la renovación al final del período. Las fechas y operaciones pendientes provienen del servidor.
- Pasaron 22 pruebas de suscripción y 10 de regresión en móvil y escritorio con Supabase, CuidaRed y Stripe interceptados. Los precios y límites de los planes se consultan al servidor. La pantalla simulada conserva sus flujos de demostración.
- La pantalla conectada de Suscripción muestra una tarjeta por plan con alcance, beneficios y selector mensual o anual. Las cotizaciones de Organización se muestran en la tarjeta del plan y conservan su propio estado por ciclo.
- Familia puede consultar Básico Familiar y Cuidado Integral antes de la publicación de tarifas. La pantalla distingue los precios iniciales de referencia de los importes publicados. Solo una oferta del servidor habilita un pago.
- La consulta manual se ofrece mientras hay un pago o cambio inmediato por confirmar. La pantalla informa cuándo terminó la consulta y conserva la actualización automática temporal.
- Validación del rediseño en `suscripcion.tsx` y `suscripcion-planes.ts`. Pasaron las 26 pruebas de suscripción en móvil y escritorio, la revisión de tipos y la compilación.

## 23/11/2026 — Seguimiento de visitas por rol y aportes públicos

- La programación organizativa identifica persona o grupo y contacto externo, con correo obligatorio, sin crear un usuario visitante. Se separan contacto y horario en dos pasos y se conserva la selección al editar. La revisión de solicitudes precarga inicio y fin; Historial ofrece solicitudes rechazadas.
- `src/features/access-real/operacion/confirmar-visita.tsx` permite a Administrador/Coordinador confirmar el resultado después del horario que valida el servidor. Las actividades grupales identifican los adultos que realmente asistieron; una cancelación no se muestra como realización verificada. El registro de campo queda pendiente de esa confirmación.
- `visitas-publicas.tsx` habilita observación y hasta tres fotografías desde el inicio de la visita autorizada, mediante código. Se conserva la selección ante errores de carga, se consulta el estado periódicamente y se respeta movimiento reducido. Los aportes se muestran al equipo separados del informe interno en `visitas-aportes.tsx`.
- Formulario público con correo e inicio/fin obligatorios; portada, guías y manual explican el nuevo recorrido. Una cuenta Familia no recibe acceso a Visitas. Iconos Lucide, fuente y tokens existentes, áreas táctiles de 48 px; selector de archivos acotado al ancho móvil para no cubrir el botón de adjuntar.
- Los botones de programación, revisión y confirmación usan tamaño de texto de 16 px y objetivo táctil de 48 px. `controles.tsx` admite ese tamaño sin alterar el predeterminado de otras pantallas. Coordinar personalmente no muestra el aviso contradictorio de ausencia de responsables.
- Validación: 168 pruebas de componentes, 52 pruebas de navegador móvil/escritorio con API y Auth interceptados, compilación y tipos correctos. Caché de la PWA comprobada (2,60 MB); oxlint de las pantallas sin nuevos avisos, con los avisos históricos de exportaciones de Fast Refresh en `controles.tsx`. La prueba SQL del backend verifica la migración real aplicada. El envío real de correos sigue pendiente de la [contraseña de aplicación del propietario](../CuidaRed-Backend/docs/ACTIVAR-CORREO-PROYECTO.md); no se enviaron correos ni se usaron identidades reales durante las pruebas.

## 23/11/2026 — Actualización local desde Integracion

- Se dejó activa `Integracion` y se actualizó por avance directo hasta `bce7395`. Incluye el trabajo de `Katriel-Cuidared-Desarrollo` y las correcciones más recientes de filtros, visitas y exportaciones de reportes.
- Se restauraron los cambios locales de acceso, marca y soporte, las imágenes y las pruebas nuevas. El historial conserva las entradas de ambas versiones, y el respaldo previo permanece en el stash local `respaldo-local-antes-pull-integracion-2026-11-23`.
- Verificación: 168 pruebas de componentes aprobadas, compilación de producción correcta y verificación de caché de la PWA correcta. No se modificó el `.env`, no se crearon commits de desarrollo ni se hizo push.

## 22/11/2026 — Contactar a soporte desde Miembros

- Administrador de Organización dispone de **Contactar soporte** y de **Solicitar eliminación a soporte** en la ficha de un miembro inactivo. El formulario selecciona miembros reales, recoge tipo, asunto y descripción, y conserva un código de seguimiento.
- `src/features/access-real/soporte.tsx` muestra los estados, la conversación y la respuesta del equipo con señales SSE y reconexión. Enviar la solicitud no elimina al usuario. Familia y otros roles no reciben este acceso de Organización.
- `api/soporte.ts` comparte el transporte HTTP existente, exportado sin modificar su política de errores. Las pruebas interceptan Auth, API y eventos: no envían mensajes ni eliminan usuarios reales. [Guía de seguimiento y eliminación](../CuidaRed-Backoffice/docs/SOPORTE-Y-USUARIOS.md).

## 21/11/2026 — Marca publicada desde el backoffice

- `src/features/auth/components/BienvenidaPresentacion.tsx` utiliza la marca vigente en la cabecera y el pie de la portada. El acceso conserva su consumidor dinámico existente, sin modificar el diseño móvil aprobado.
- `src/lib/marca.ts` conserva la última referencia válida por proyecto, limita las imágenes al bucket público de marca del Supabase configurado, ignora respuestas antiguas y admite eventos SSE con ambos finales de línea. Restaurar el logo predeterminado elimina la referencia guardada.
- `tests/access/marca.spec.ts` verifica publicación/restauración en portada y login, desconexión y rechazo de URLs externas. Validación junto con las regresiones de acceso, registro y visitas: 69 pruebas aprobadas y una comprobación móvil omitida en escritorio; build, verificación de caché y oxlint de los archivos de esta entrega correctos. Auth, API y eventos se simulan; no se envían correos reales.

## 21/11/2026 — Ajuste de las pantallas de acceso y registro

- El login conserva el panel informativo original, el logo y el fondo de círculos, sin fotografías. La navegación a la portada muestra solo la flecha, con nombre accesible.
- «Activar cuenta» y «Crear cuenta» comparten una fila como enlaces con iconos Lucide, sin los dos recuadros delineados. Cada acción conserva un área táctil de 48 px y un divisor la separa del acceso principal.
- Acceso, autorregistro, activación y recuperación conservan el mismo ancho máximo de 460 px en escritorio. Las cabeceras de los formularios son más compactas; los pasos con varios campos aprovechan dos columnas en escritorio y una en móvil. Se mantienen los controles táctiles de al menos 48 px y los campos con letra de 16 px.
- El login móvil sube el logo y el formulario y se ve completo desde 320×640. Los círculos decorativos se ajustan a las esquinas para dejar libre el logo. Se respetan las áreas seguras de la PWA y se permite el desplazamiento al abrir el teclado o mostrar contenido adicional.
- Crear cuenta tiene una sola flecha en la cabecera: vuelve al paso anterior o al punto de la portada desde el que se entró. El consentimiento separa la casilla de los enlaces legales para evitar saltos y espacios excesivos en móvil.
- Validación: 63 pruebas Playwright de acceso, registro, visitas públicas y regreso a la portada superadas con Auth y API simulados. La revisión de diseño cubre los cinco pasos de Familia y Organización, la invitación y la recuperación: escritorio de 768 a 1920 px de ancho y móvil de 320 a 428 px. Se comprueban el teclado con la ventana reducida y las áreas seguras; esa comprobación se omite en el proyecto de escritorio. Compilación de producción y comprobación de tipos correctas; sin avisos de oxlint en los archivos revisados.

## 21/11/2026 — Ajustes de la fase 7

- Los filtros de Resumen y Reportes cargan municipios, sectores y personal autorizado según el módulo. Un período invertido suspende la consulta, el análisis avanzado y las exportaciones hasta que se corrija.
- La tabla, los indicadores y el gráfico de visitas distinguen las institucionales sin expediente. Familia deja de mostrar los controles, estados e indicadores de seguimiento por ausencia de visitas.
- El informe médico describe como fuera de vigencia las indicaciones omitidas. La verificación del inicio y el fin se hace en el backend al generar el informe.
- Los gráficos conservan sus tablas accesibles si se interrumpe la descarga del componente. La pantalla mantiene los datos y vuelve a habilitar las exportaciones al recuperar la conexión. El PDF puede descargarse con las tablas si el módulo de gráficos sigue inaccesible.
- Validación: 168 pruebas de componentes, 148 pruebas de navegador y compilación correctas. Tras el ajuste final del PDF se repitieron seis pruebas de exportación y reconexión en móvil y escritorio.
- Supabase CuidaRed tiene aplicada la migración de Reportes CUIDARED-012 (`20261121064256`) desde el 21/11/2026, con aprobación del usuario. Falta probar el recorrido conectado con una sesión real.

## 20/11/2026 — Cierre de la fase 6 y fase 7 (reportes) en modo conectado

- Alertas (fase 6): la campana con contador solo aparece a quien recibe avisos (Coordinador y Administrador de Organización). Se quitó el filtro «Archivadas», se añadió el filtro por adulto mayor en Alertas y el botón «Ver alertas de este adulto» en el expediente, y una alerta que cambió de estado muestra un mensaje propio. Pruebas en `tests/access/alertas.spec.ts`. Actualizados el manual (§6.2) y la RTM (CU-09 y CU-10).
- Resumen de casos y reportes (fase 7): nuevas pantallas `resumen-casos.tsx` (ruta `/operacion/:cuentaId/resumen`, permiso `resumen:ver`) y `reportes.tsx` (ruta `/operacion/:cuentaId/reportes`, permiso `reportes:ver` y plan con `dashboard_metricas`), con `resumen-datos.ts`, `reportes-modelo.ts`, `reportes-errores.ts` y `api/reportes.ts`. Los cuatro reportes son adultos registrados, visitas realizadas (solo Organización), necesidades y casos prioritarios. El CSV lo entrega el servidor; el PDF y el Excel se generan en el navegador después de registrar la exportación; el Excel y el análisis avanzado requieren `reportes_avanzados`.
- Informe médico (fase 7): botón en el expediente para Coordinador y Cuidador con alcance. El PDF se arma en el navegador (`informe-medico.tsx`, `informe-medico-pdf.ts`, `informe-medico-datos.ts`). No está disponible sin conexión.
- Demo separado: `src/features/gestion/lib/reportes-comun.ts` reúne el modelo y las utilidades de descarga sin el almacén del prototipo, así que el modo conectado ya no carga el almacén demo (`lib/reportes.ts` lo reexporta). `client.ts` incorpora `apiDescarga` para bajar el CSV con la sesión. Auditoría muestra la acción «Exportación» y las entidades «Reporte exportado» e «Informe médico».
- Validación: typecheck correcto; vitest, 169 pruebas en 8 archivos; test:access, 284 pruebas superadas; oxlint sin advertencias nuevas; build correcto.
- En modo conectado la salida de impresión es el PDF.
- Pendiente tras la revisión independiente (sin bloqueantes):
  - Si el archivo falla después de registrar la exportación, el mensaje no lo dice y un reintento crea otro registro.
  - Accesibilidad: la región `aria-live` cubre todo el reporte y el selector de tipo no se maneja con flechas.
  - El aviso de exportación sigue visible al cambiar filtros. Algunos 403 pierden su mensaje específico.
  - En el PDF del informe, el sexo sale como `F`/`M`, la nota final puede pisar el pie y un estado general vacío se explica como restricción de rol.
  - Faltan pruebas del error de CSV y del contenido de PDF/Excel.

## 19/11/2026 — Integración de visitas y acceso conectado

- La portada, las solicitudes de visita y el calendario conviven con Backoffice, la recuperación de sesión al abrir avisos y Web Push. Se conservan la programación recurrente, la revisión de evidencias y la sincronización de necesidades.
- Visitas y Solicitudes se muestran solo en Organización. Las capturas de visitas se guardan por usuario en IndexedDB y vuelven a la cola al abrir CuidaRed en el mismo navegador. Las necesidades pendientes se conservan en la pestaña.
- Las pruebas en móvil y escritorio verifican acceso, alertas, visitas y captura sin conexión. La compilación comprueba el arranque de la PWA y la exclusión de las respuestas de la API de la caché.

## 17/11/2026 — Integración de la PWA con Backoffice

- La PWA combina la marca dinámica y la telemetría de Backoffice con Web Push y la recuperación de sesión vigente. Mantiene los avisos de cuenta o usuario deshabilitado.
- La cola por pestaña conserva las visitas y las necesidades rechazadas si Backoffice deshabilita su cuenta. El usuario puede reintentar la misma captura o descartarla.

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
