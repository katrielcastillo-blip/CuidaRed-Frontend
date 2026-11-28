/*
 * datos-ayuda.ts — Contenido fijo de la ayuda flotante: Aprende a usar CuidaRed, Preguntas frecuentes, idioma, tema,
 * temas de soporte y opciones del menú. Es contenido estático (no hay backend de ayuda): para cambiar un texto basta
 * editar este archivo. Estructura y títulos alineados con el Figma (pantallas 13 a 18); los pasos salen del manual
 * (docs/MANUAL-USUARIO.md) y de lo que hace la app.
 *
 * Sin cubrir a propósito: el tema «Agenda y tareas» (el manual no lo documenta) y los videos tutoriales (no existen).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import type { NombreIcono } from '@/components/ui'

export interface ArticuloAyuda {
  id: string
  categoria: string
  titulo: string
  pasos: string[]
  /** Recuadro verde bajo los pasos. */
  consejo?: string
}

export interface CategoriaAyuda {
  id: string
  nombre: string
  icono: NombreIcono
}

/** Temas de «Aprende a usar CuidaRed»; los que no tienen guías no se muestran. */
export const CATEGORIAS_AYUDA: CategoriaAyuda[] = [
  { id: 'adultos', nombre: 'Adultos mayores', icono: 'elderly' },
  { id: 'visitas', nombre: 'Visitas', icono: 'calendar_month' },
  { id: 'necesidades', nombre: 'Necesidades', icono: 'volunteer_activism' },
  { id: 'alertas', nombre: 'Alertas y riesgo', icono: 'notifications_active' },
  { id: 'agenda', nombre: 'Agenda y tareas', icono: 'checklist' },
  { id: 'conexion', nombre: 'Sin conexión', icono: 'wifi' },
]

/** «Lo más consultado» (Figma): ids de ARTICULOS_AYUDA en orden. */
export const MAS_CONSULTADOS = ['registrar-visita', 'registrar-necesidad', 'sin-internet', 'colores-riesgo']

export const ARTICULOS_AYUDA: ArticuloAyuda[] = [
  {
    id: 'ver-adultos', categoria: 'adultos', titulo: 'Ver a los adultos mayores que acompañas',
    pasos: [
      'Toca Adultos en el menú.',
      'Verás las personas a las que tienes acceso. Si eres voluntario o cuidador, solo aparecen las que te asignó tu coordinador.',
      'Cada tarjeta muestra el nivel de riesgo y cuántos días han pasado desde la última visita.',
      'Toca una persona para ver su perfil: datos de contacto, condición general, historial de visitas y necesidades.',
    ],
    consejo: 'Si no ves a una persona que visitas, pide al coordinador que te la asigne.',
  },
  {
    id: 'registrar-perfil', categoria: 'adultos', titulo: 'Registrar un perfil de adulto mayor',
    pasos: [
      'Ve a Adultos y toca Nuevo perfil.',
      'Paso 1, identificación: nombre, apellido, cédula, fecha de nacimiento, sexo y teléfono (opcional).',
      'Paso 2, condición y riesgo: zona, contacto de emergencia, autonomía, condiciones, nivel de riesgo social (obligatorio) y confirmación del consentimiento informado.',
      'Toca Guardar. Si falta algo, el campo se marca en rojo con la explicación y lo que escribiste se conserva.',
    ],
    consejo: 'Desde el perfil puedes editar los datos, asignar voluntarios, hacer la evaluación de riesgo o desactivar el perfil. Crear perfiles necesita internet.',
  },
  {
    id: 'informe-medico', categoria: 'adultos', titulo: 'Generar el informe médico',
    pasos: [
      'Abre el expediente del adulto mayor y ve a la sección de seguimiento.',
      'Toca Generar informe médico. CuidaRed consulta la información en ese momento.',
      'Revisa el informe en pantalla.',
      'Si necesitas una copia, toca Descargar informe en PDF.',
    ],
    consejo: 'Lo pueden generar el coordinador y el cuidador. Contiene datos sensibles: compártelo solo con quien corresponda.',
  },
  {
    id: 'privacidad', categoria: 'adultos', titulo: 'Privacidad y buen uso de la información',
    pasos: [
      'Usa la información solo para el acompañamiento de la persona; no la compartas por otros medios, como redes sociales o mensajería personal.',
      'Cada rol ve únicamente lo que necesita: el voluntario, solo a las personas asignadas; el familiar, solo a su familiar.',
      'Las acciones importantes quedan registradas: quién, qué y cuándo.',
      'No escribas diagnósticos médicos detallados: CuidaRed no es un expediente clínico.',
    ],
    consejo: 'Si perdiste tu teléfono o sospechas un acceso indebido, avisa de inmediato al administrador de tu organización.',
  },
  {
    id: 'registrar-visita', categoria: 'visitas', titulo: 'Cómo registrar una visita',
    pasos: [
      'Abre Visitas o el perfil del adulto y toca la visita de hoy o «Registrar visita».',
      'Si estás en la casa, toca «Iniciar visita»: se guarda la hora de llegada.',
      'Elige cómo encontraste a la persona (Estable, Requiere atención o Situación crítica) y marca lo que revisaste.',
      'Escribe observaciones breves. Puedes usar abreviaturas que se completan solas, como «sn» por «sin novedad».',
      'Toca «Registrar visita». La verás en el historial.',
    ],
    consejo: 'Si ves que falta algo (medicinas, comida, transporte), registra también una necesidad.',
  },
  {
    id: 'programar-visita', categoria: 'visitas', titulo: 'Programar una visita',
    pasos: [
      'Ve a Visitas y toca Programar visita.',
      'Elige la persona y el voluntario responsable.',
      'Elige la fecha y la hora, y escribe notas para el voluntario.',
      'Guarda la visita. CuidaRed avisa si la fecha ya pasó o si el voluntario tiene otra visita a esa hora.',
    ],
    consejo: 'Programar visitas necesita internet.',
  },
  {
    id: 'registrar-necesidad', categoria: 'necesidades', titulo: 'Cómo registrar una necesidad',
    pasos: [
      'Toca Registrar necesidad al terminar una visita, en el perfil de la persona o en Inicio.',
      'Elige la categoría: Medicamentos, Alimentación, Transporte, Compañía u Otros apoyos.',
      'Describe la necesidad en pocas palabras y toca Registrar necesidad. Queda como Pendiente.',
    ],
    consejo: 'Una necesidad de Medicamentos pendiente genera una alerta de Medicamento pendiente; una de otra categoría con prioridad Alta, una alerta de Necesidad prioritaria.',
  },
  {
    id: 'estado-necesidad', categoria: 'necesidades', titulo: 'Actualizar el estado de una necesidad',
    pasos: [
      'Abre la necesidad desde el perfil de la persona.',
      'Elige el nuevo estado: En proceso, Satisfecha o Inactiva.',
      'Si quieres, agrega una nota.',
      'Abajo verás el historial: quién cambió el estado y cuándo.',
    ],
  },
  {
    id: 'colores-riesgo', categoria: 'alertas', titulo: 'Qué significan los colores del riesgo',
    pasos: [
      'Triángulo rojo: riesgo alto, atención prioritaria.',
      'Rombo ámbar: riesgo medio, refuerza las visitas y la red de apoyo.',
      'Círculo verde: riesgo bajo, seguimiento habitual.',
    ],
    consejo: 'El riesgo se reconoce por el color y por la forma, sin necesidad de leer.',
  },
  {
    id: 'atender-alertas', categoria: 'alertas', titulo: 'Atender y resolver una alerta',
    pasos: [
      'Abre Alertas, o toca una notificación, y entra a la alerta.',
      'Revisa por qué se generó: la descripción y su fuente.',
      'Si quieres dejar constancia de que ya la trabajas, toca Iniciar atención (solo coordinación).',
      'Toca Resolver alerta, escribe la acción que tomaste (hasta 500 caracteres) y confirma. Quedan registradas la acción, la fecha y quién la atendió.',
    ],
    consejo: 'Si desaparece la causa de la alerta, se resuelve sola y lo indica. El cuidador puede resolver alertas, pero no iniciar la atención.',
  },
  {
    id: 'resumen-casos', categoria: 'alertas', titulo: 'Revisar el resumen de casos',
    pasos: [
      'Abre Resumen (coordinador y administrador de la organización).',
      'Arriba verás los indicadores: casos activos, prioridades, alertas abiertas y necesidades activas. No cambian con los filtros.',
      'Escribe al menos 2 letras para buscar, filtra por estado, prioridad o riesgo, y ordena la lista.',
      'Toca Quitar filtros para volver a ver todos los casos, o el nombre de un caso para abrir su expediente.',
    ],
  },
  {
    id: 'sin-internet', categoria: 'conexion', titulo: 'Trabajar sin conexión y sincronizar',
    pasos: [
      'Si se va la conexión, el ícono de nube de la barra superior cambia a «Sin conexión».',
      'Puedes seguir registrando visitas y necesidades con normalidad: se guardan en tu teléfono como pendientes de sincronización.',
      'Cuando vuelve la señal, CuidaRed lo envía todo sola. En Conexión y sincronización ves los pendientes y puedes tocar «Sincronizar ahora».',
      'Si algo no se pudo enviar, aparece el motivo y puedes reintentarlo o descartarlo.',
    ],
    consejo: 'Otras acciones, como crear perfiles, programar visitas o gestionar alertas, necesitan internet.',
  },
]

export interface CategoriaPregunta { id: string; nombre: string }

export const CATEGORIAS_PREGUNTAS: CategoriaPregunta[] = [
  { id: 'cuenta', nombre: 'Mi cuenta' },
  { id: 'plan', nombre: 'Plan y pagos' },
  { id: 'privacidad', nombre: 'Privacidad' },
  { id: 'conexion', nombre: 'Sin conexión' },
  { id: 'alertas', nombre: 'Alertas' },
]

export interface PreguntaFrecuente { id: string; categoria: string; pregunta: string; respuesta: string }

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  { id: 'olvide', categoria: 'cuenta', pregunta: '¿Qué hago si olvidé mi contraseña?', respuesta: 'En la pantalla de inicio de sesión toca «¿Olvidaste tu contraseña?», escribe tu correo y usa el código que recibes para crear una nueva.' },
  { id: 'perfil', categoria: 'cuenta', pregunta: '¿Dónde cambio mi contraseña o mis datos?', respuesta: 'En Mi perfil: toca tu avatar en la esquina superior derecha o abre Más y elige Mi perfil. Allí encuentras Editar perfil y Cambiar contraseña.' },
  { id: 'pantalla', categoria: 'cuenta', pregunta: '¿Por qué no veo una pantalla que sí ve mi compañero?', respuesta: 'Cada rol ve únicamente lo que necesita. Si crees que deberías tener acceso, habla con el administrador.' },
  { id: 'acceso', categoria: 'cuenta', pregunta: 'Me sale «Acceso no autorizado».', respuesta: 'Esa función no corresponde a tu rol. Si crees que deberías tener acceso, habla con el administrador.' },
  { id: 'activa', categoria: 'cuenta', pregunta: 'Mi cuenta dice que no está activa.', respuesta: 'El administrador la desactivó o aún no la activaste con tu código. Contacta a tu organización.' },
  { id: 'persona', categoria: 'cuenta', pregunta: 'No veo a una persona que visito.', respuesta: 'Pide al coordinador que te la asigne.' },
  { id: 'sesion', categoria: 'cuenta', pregunta: '¿Por qué se cerró mi sesión sola?', respuesta: 'Por seguridad, la sesión se cierra tras 30 minutos sin usar la app. Vuelve a entrar con tu correo y contraseña.' },
  { id: 'cambiar-plan', categoria: 'plan', pregunta: '¿Cómo cambio de plan?', respuesta: 'La persona titular puede cambiar de plan o cancelar la renovación en Suscripción y pagos (en Más, Plan y pago). Un plan más caro con la misma periodicidad se aplica cuando se confirma el cargo proporcional; un plan de menor precio o con otra periodicidad se aplica en el próximo corte.' },
  { id: 'prueba', categoria: 'plan', pregunta: '¿Qué pasa cuando termina la prueba gratuita?', respuesta: 'Al terminar la prueba o vencer el plan solo quedan la lectura de la cuenta y la gestión de la suscripción. Los roles autorizados conservan acceso a Suscripción y pagos para contratar un plan.' },
  { id: 'pagos', categoria: 'plan', pregunta: '¿Los pagos son reales?', respuesta: 'Por ahora la contratación se hace en Stripe Sandbox con datos de prueba.' },
  { id: 'datos', categoria: 'privacidad', pregunta: '¿Quién puede ver los datos de un adulto mayor?', respuesta: 'Cada rol ve únicamente lo que necesita: el voluntario, solo a las personas asignadas; el familiar, solo a su familiar. Las acciones importantes quedan registradas: quién, qué y cuándo.' },
  { id: 'compartir', categoria: 'privacidad', pregunta: '¿Puedo compartir la información por mensajería?', respuesta: 'No. Usa la información solo para el acompañamiento de la persona y no la compartas por redes sociales ni mensajería personal.' },
  { id: 'internet', categoria: 'conexion', pregunta: '¿Puedo usar la app sin internet?', respuesta: 'Sí para registrar visitas y necesidades: se guardan en tu teléfono y se envían solas cuando vuelve la señal. Otras acciones, como crear perfiles, programar visitas o gestionar alertas, necesitan internet.' },
  { id: 'conflicto', categoria: 'conexion', pregunta: '¿Y si otra persona cambió lo mismo mientras yo estaba sin señal?', respuesta: 'CuidaRed conserva el cambio más reciente y te informa cuál versión quedó.' },
  { id: 'pendiente', categoria: 'conexion', pregunta: '¿Y si algo no se pudo enviar?', respuesta: 'Queda guardado en tu teléfono y se reintenta solo. Si el error persiste aparece el motivo y puedes reintentar o descartarlo desde Conexión y sincronización.' },
  { id: 'cerrar', categoria: 'conexion', pregunta: '¿Puedo cerrar sesión con pendientes?', respuesta: 'Sí. Se enviarán cuando vuelvas a entrar con tu misma cuenta.' },
  { id: 'critica', categoria: 'alertas', pregunta: 'Marqué «Situación crítica». ¿Se avisa al coordinador?', respuesta: 'Queda registrado en la visita, pero no se crea una alerta automática. Avisa al coordinador por tu canal habitual y, si hay peligro, llama al 9-1-1.' },
  { id: 'avisos', categoria: 'alertas', pregunta: '¿Quién recibe las notificaciones de alertas?', respuesta: 'El coordinador y, en una organización, el administrador que tengan acceso al caso. El cuidador consulta sus alertas, pero no recibe notificaciones.' },
]

export interface IdiomaAyuda { id: string; nombre: string; detalle: string; disponible: boolean }

export const IDIOMAS: IdiomaAyuda[] = [
  { id: 'es', nombre: 'Español', detalle: 'Español (República Dominicana)', disponible: true },
  { id: 'en', nombre: 'English', detalle: 'Inglés', disponible: false },
]

export interface TemaVisual { id: 'claro' | 'oscuro' | 'sistema'; nombre: string; detalle: string; icono: NombreIcono; disponible: boolean }

/** Solo existe el tema claro: los demás se muestran deshabilitados como «Próximamente». */
export const TEMAS_VISUALES: TemaVisual[] = [
  { id: 'claro', nombre: 'Claro', detalle: 'Fondo claro, el que usa CuidaRed hoy', icono: 'light_mode', disponible: true },
  { id: 'oscuro', nombre: 'Oscuro', detalle: 'Fondo oscuro', icono: 'dark_mode', disponible: false },
  { id: 'sistema', nombre: 'Según el sistema', detalle: 'Sigue el ajuste de tu teléfono', icono: 'brightness_auto', disponible: false },
]

export interface TemaSoporte { id: string; nombre: string; icono: NombreIcono }

export const TEMAS_SOPORTE: TemaSoporte[] = [
  { id: 'falla', nombre: 'Algo no funciona', icono: 'error' },
  { id: 'acceso', nombre: 'Mi cuenta y acceso', icono: 'key' },
  { id: 'plan', nombre: 'Plan y pagos', icono: 'credit_card' },
  { id: 'otra', nombre: 'Otra cosa', icono: 'more_horiz' },
]

export type IdAyuda = 'aprende' | 'preguntas' | 'idioma' | 'soporte' | 'tema' | 'accesibilidad'
export interface OpcionAyuda { id: IdAyuda; nombre: string; icono: NombreIcono }

/** Opciones del menú de ayuda flotante (Figma 01b); `id` es también el id de la sección (`/operacion/:cuenta/:id`). */
export const OPCIONES_AYUDA: OpcionAyuda[] = [
  { id: 'aprende', nombre: 'Aprende a usar CuidaRed', icono: 'menu_book' },
  { id: 'preguntas', nombre: 'Preguntas frecuentes', icono: 'quiz' },
  { id: 'idioma', nombre: 'Cambiar idioma', icono: 'translate' },
  { id: 'soporte', nombre: 'Contactar soporte', icono: 'support_agent' },
  { id: 'tema', nombre: 'Modo claro u oscuro', icono: 'dark_mode' },
  { id: 'accesibilidad', nombre: 'Accesibilidad', icono: 'accessibility_new' },
]
