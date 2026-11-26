# Rediseño de la PWA · 25 de noviembre de 2026

## Referencias y alcance

Se aplica la guía entregada por el equipo, `SKILL-cuidared-ui-ux.md`, y las capturas «01-inicio v3» y «01b-inicio · ayuda abierta». Archivo Figma: `u6X5xPfwLqZLrMjsa1AHOe`; referencias `2064:1179`, `2062:659` y `2083:1092`.

Figma permitió consultar el índice del rediseño de Administrador, pero el límite de consultas de la conexión impidió obtener las capturas y propiedades completas de esos nodos. Las imágenes adjuntas guían la composición del inicio y la ayuda. Las demás pantallas conservan sus flujos y reciben los componentes comunes de la marca; no se afirma una reproducción exacta de todos los nodos.

El trabajo se realiza en `feat/redisenio-pwa`, dentro de CuidaRed-Frontend. Se conservan los cambios locales de acceso, marca y soporte anteriores a esta entrega. No requiere migración, cambios de API ni nuevas variables de entorno.

## Composición y sistema visual

- Inicio operativo con saludo e identidad reales, conexión visible, notificaciones según permisos, suscripción, indicadores, pendientes, casos prioritarios y accesos a los módulos disponibles.
- Las cifras proceden de los endpoints existentes de resumen, adultos, necesidades, visitas, solicitudes y alertas. Solo se consultan los recursos permitidos por la cuenta activa. No se utilizan cifras de ejemplo en producción.
- Los datos sin respuesta aparecen como «—», con el estado de consulta correspondiente. Un error no se presenta como cero casos.
- El umbral de días sin visita procede del servidor. Las cuentas Familia no reciben accesos ni consultas nuevas de visitas.
- Los enlaces de indicadores abren las pantallas existentes. «Ver planes» conserva el acceso a suscripción y pagos; el detalle completo de la cuenta sigue disponible en un desplegable y en Mi cuenta.
- Perfil personal y listado/resumen de envejecientes con superficies blancas, avatares de iniciales, jerarquía tipográfica y controles existentes. No se inventan fotografías de personas.
- Montserrat para encabezados, botones y etiquetas; Open Sans para el cuerpo. Las fuentes latinas se sirven desde el propio proyecto.
- Material Symbols Outlined sustituye las importaciones anteriores de iconos. El adaptador conserva sus nombres exportados para evitar cambios en los flujos de negocio. Los logos oficiales siguen siendo imágenes y siguen utilizando la configuración de marca existente.
- Se autoaloja un subconjunto de 150 símbolos de unos 33 KB. Su licencia y procedimiento de regeneración están en `src/assets/fonts/README.md` y `scripts/preparar-iconos.mjs`. No hay dependencia de Google Fonts en tiempo de ejecución.

Decisiones donde no se pudieron contrastar todas las propiedades de Figma: controles de 12 px de radio, tarjetas de 16 px, paneles de 24 px, texto auxiliar de al menos 14 px y objetivos táctiles comunes de al menos 48 px. Se mantienen los puntos de corte del proyecto para conservar su comportamiento adaptable. La cabecera utiliza azul noche sólido con acento verde, siguiendo la prohibición de degradados decorativos de la guía adjunta.

## Ayuda flotante: solo diseño

El isotipo oficial abre un panel con estas seis opciones:

1. Aprende a usar CuidaRed.
2. Preguntas frecuentes.
3. Cambiar idioma.
4. Contactar soporte.
5. Modo claro u oscuro.
6. Accesibilidad.

Las seis opciones son botones deshabilitados, acompañados de un aviso de disponibilidad futura. No envían solicitudes, no cambian el idioma, el tema ni la configuración de accesibilidad. Abrir y cerrar el panel sí está implementado para poder revisar su diseño. Se puede cerrar con Escape o pulsando fuera; se conserva el foco del teclado y el panel se cierra al cambiar de ruta.

El menú nuevo no sustituye las funciones existentes de soporte, manual o recuperación de acceso.

## Funciones conservadas

Los formularios, validaciones, contratos HTTP, permisos, asignaciones, consentimiento, historial, visitas, solicitudes externas, evidencias, cola de sincronización, notificaciones, reportes y suscripciones mantienen sus manejadores existentes. El rediseño no crea roles ni cuentas nuevas. El Service Worker y la separación entre caché de recursos y datos sensibles se conservan.

Para revisar el cambio, iniciar el proyecto con `npm run dev` y acceder con una cuenta existente. No hace falta configurar servicios adicionales para el rediseño.

## Verificación

`tests/access/redisenio-pwa.spec.ts` cubre indicadores con respuestas interceptadas, el umbral de seguimiento, enlaces existentes, exclusión de visitas en Familia, seis opciones inactivas, foco del teclado, ajuste a 360/768/1280 px, texto al 200 % y movimiento reducido. Las pruebas no envían correos ni pagos y no acceden a datos reales.

Se comprueban también los flujos existentes de la batería de acceso, las pruebas de componentes, tipos, compilación y tamaño de la caché PWA. Las capturas de revisión se generan como artefactos de Playwright; no se incluyen datos personales reales.

Resultados de cierre:

- Batería completa de navegador: **371 pruebas correctas y 1 omitida**; la comprobación de teclado móvil se omite en escritorio por diseño de esa prueba.
- Después de los últimos ajustes del encabezado y del enlace al expediente: **42 pruebas de operación/rediseño correctas**; tras el contraste final de los campos: **10 pruebas del rediseño correctas** y capturas regeneradas.
- Componentes: **168 pruebas correctas**. Compilación de producción y comprobación de tipos correctas.
- Lint termina sin errores; mantiene avisos de Fast Refresh en exportaciones compartidas y otros avisos existentes del proyecto.
- Precache de recursos: **2,61 MB de 50 MB**. El navegador abre `/` y `/inicio` sin conexión mediante el Service Worker; las rutas y peticiones de API quedan fuera de esa caché.
- Contraste de las combinaciones revisadas: texto secundario sobre fondo 4,51:1, blanco sobre primario 9,52:1 y estados suaves entre 4,72:1 y 5,68:1. Los campos conservan un borde identificable de mayor contraste que los separadores de tarjetas.
