/*
 * legal.ts — Textos de los Términos y Condiciones y de la Política de Privacidad de CuidaRed.
 * Módulo: auth (SRS §8.2.2.3.1 Éticos · §8.2.2.3.2 Interoperabilidad · §8.2.2.3.3 Legislativos ·
 * §8.2.2.3.4 Privacidad · §8.2.2.3.5 Seguridad · §15 Legal y derechos de autor · §17.3 · §18.6).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Los párrafos admiten **negrita**. Cada sección tiene un id que sirve de ancla para el índice.
 */
import { PRODUCTO } from '@/lib/proyecto'

export type Bloque =
  /** Párrafo. */
  | string
  | { lista: string[]; ordenada?: boolean }
  /** Subsección con título propio. */
  | { sub: string; texto: string | string[] }
  /** Recuadro destacado. */
  | { aviso: string; tono?: 'info' | 'warning' }
  /** Tabla de dos columnas (en móvil se apila). */
  | { tabla: { cabecera: [string, string]; filas: Array<[string, string]> } }

export interface Seccion {
  id: string
  titulo: string
  bloques: Bloque[]
}

export interface Documento {
  titulo: string
  resumen: string
  secciones: Seccion[]
  actualizado: string
}

const ACTUALIZADO = `Versión ${PRODUCTO.version} · Última actualización: 22 de octubre de 2026`

const DESCARGO = `CuidaRed es una herramienta tecnológica diseñada exclusivamente para facilitar la coordinación y el seguimiento comunitario de adultos mayores. **No sustituye servicios médicos, instituciones públicas ni organismos de emergencia.** Ante una emergencia de salud o de seguridad, llama de inmediato al **9-1-1**.`

/** Pasos del procedimiento de respuesta a incidentes de privacidad (SRS §8.2.2.3.4 g). */
const PASOS_INCIDENTE = [
  '**Identificación del incidente:** se confirma qué ocurrió (acceso no autorizado, pérdida, exposición o modificación indebida de información), cuándo y quién lo detectó.',
  '**Contención del acceso:** se detiene el daño de inmediato: se desactivan las cuentas comprometidas, se cierran sus sesiones, se cambian contraseñas y se bloquea el canal afectado.',
  '**Evaluación del alcance:** se determina qué datos, qué personas (adultos mayores, familiares, usuarios) y qué registros se vieron afectados, y el riesgo que esto supone para ellas.',
  '**Preservación de evidencias:** se conservan sin alterar los registros de auditoría y demás evidencias necesarias para entender lo ocurrido y, si corresponde, para las autoridades.',
  '**Corrección de la vulnerabilidad:** se corrige la causa (error de configuración, permiso indebido, fallo de software o mala práctica) y se verifica que la corrección funciona.',
  '**Documentación del incidente:** se deja constancia escrita de lo ocurrido, las acciones tomadas, los responsables y las lecciones aprendidas.',
  '**Comunicaciones y notificaciones:** se determina a quién debe informarse (personas afectadas, la organización, autoridades competentes) conforme a la Ley No. 172-13, la Ley No. 53-07 y las políticas aplicables, y se realizan las comunicaciones que correspondan.',
]

/* ═════════════════════════════ TÉRMINOS Y CONDICIONES ═════════════════════════════ */
export const TERMINOS: Documento = {
  titulo: 'Términos y Condiciones',
  resumen:
    'Estas son las reglas para usar **CuidaRed**. Al activar tu cuenta o registrar una organización declaras que las leíste y las aceptas. Léelas junto con la Política de Privacidad, que explica cómo se tratan los datos personales.',
  secciones: [
    {
      id: 'que-es',
      titulo: '1. Qué es CuidaRed',
      bloques: [
        `CuidaRed es una aplicación web progresiva (PWA) para que organizaciones comunitarias de la República Dominicana den seguimiento a adultos mayores en situación de vulnerabilidad: perfiles, visitas comunitarias, necesidades pendientes, alertas, resumen de seguimiento y reportes básicos.`,
        `Ha sido desarrollada por el ${PRODUCTO.equipo} en el marco del curso ${PRODUCTO.curso} del ${PRODUCTO.institucion}. La versión ${PRODUCTO.version} es un **producto mínimo viable (MVP) académico**.`,
      ],
    },
    {
      id: 'aceptacion',
      titulo: '2. Aceptación de estos términos',
      bloques: [
        'Usar CuidaRed implica aceptar estos Términos y la Política de Privacidad. La aceptación se pide de forma expresa al activar una cuenta o al registrar una organización. Si no estás de acuerdo, no utilices la plataforma.',
      ],
    },
    {
      id: 'descargo',
      titulo: '3. Naturaleza del servicio y exención de responsabilidad',
      bloques: [
        { aviso: DESCARGO, tono: 'warning' },
        'CuidaRed no realiza diagnósticos, no da indicaciones médicas y no decide sobre la atención de ninguna persona. Las clasificaciones de riesgo y las alertas son **apoyos para organizar el cuidado**; las decisiones las toman siempre las personas responsables.',
        'El software, en su versión MVP, se proporciona **"tal cual" ("as is")** para fines de evaluación académica y pilotaje, sin garantías comerciales sobre su disponibilidad continua, su funcionamiento sin errores o su continuidad operativa. El equipo de desarrollo y el INTEC no asumen responsabilidad por decisiones médicas, de cuidado o de cualquier otro tipo tomadas con base en la información registrada.',
      ],
    },
    {
      id: 'cuentas',
      titulo: '4. Cuentas y acceso',
      bloques: [
        {
          lista: [
            'Una organización se incorpora registrándose con una cuenta de **Administrador**.',
            'Las cuentas personales (coordinadores, voluntarios y familiares responsables) **las crea el administrador** de la organización. La persona invitada activa su cuenta eligiendo su propia contraseña; el administrador nunca la conoce.',
            'Tu cuenta es **personal e intransferible**. No compartas tu contraseña ni dejes la sesión abierta en dispositivos de otras personas.',
            'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
            'Por seguridad, tras 5 intentos fallidos el acceso se bloquea temporalmente 5 minutos, y la sesión se cierra tras 30 minutos sin actividad o 12 horas de uso.',
            'Si olvidas tu contraseña, puedes restablecerla con un código de un solo uso que caduca a los 15 minutos.',
          ],
        },
      ],
    },
    {
      id: 'roles',
      titulo: '5. Roles y responsabilidades',
      bloques: [
        'Cada persona solo puede usar las funciones y ver los datos que corresponden a su rol (control de acceso basado en roles y principio de mínimo privilegio):',
        { sub: 'Administrador', texto: 'Gestiona usuarios, roles y la configuración de la organización; consulta perfiles, alertas, resumen, reportes y el registro de actividades. Es responsable de dar de baja a tiempo las cuentas de quienes dejan la organización.' },
        { sub: 'Coordinador', texto: 'Registra y mantiene los perfiles, evalúa el riesgo, asigna voluntarios, programa visitas, atiende alertas y consulta el resumen y los reportes.' },
        { sub: 'Voluntario', texto: 'Registra de forma veraz las visitas y necesidades de los adultos mayores que tiene asignados, incluso sin conexión, y sincroniza esos registros en cuanto recupere internet.' },
        { sub: 'Familiar responsable', texto: 'Consulta el historial de visitas y el estado de las necesidades del adulto mayor a su cargo. Su acceso es solo de consulta y debe mantener actualizados sus datos de contacto.' },
      ],
    },
    {
      id: 'etica',
      titulo: '6. Principios éticos de uso',
      bloques: [
        'Toda persona usuaria se compromete a respetar estos principios:',
        {
          lista: [
            '**Finalidad:** usar la información solo para el seguimiento comunitario, la identificación de necesidades, la gestión de visitas y alertas y las demás actividades de CuidaRed.',
            '**Minimización:** registrar únicamente los datos necesarios; no anotar información que no tenga una finalidad clara.',
            '**Confidencialidad:** tratar la información de los adultos mayores como confidencial y no compartirla fuera de los canales y propósitos autorizados (ni por mensajería, ni en redes sociales, ni con terceros).',
            '**No discriminación:** nunca usar la edad, la condición social o económica, la salud o el nivel de vulnerabilidad para excluir o perjudicar a una persona.',
            '**Respeto a la dignidad:** el seguimiento, la clasificación de riesgo y las alertas son mecanismos de apoyo al cuidado, no etiquetas para estigmatizar a nadie.',
            '**Responsabilidad:** usar la información solo dentro de las funciones que te fueron autorizadas.',
          ],
        },
      ],
    },
    {
      id: 'prohibido',
      titulo: '7. Usos prohibidos',
      bloques: [
        {
          lista: [
            'Acceder o intentar acceder a cuentas, datos o funciones que no te corresponden.',
            'Compartir tus credenciales o usar las de otra persona.',
            'Registrar información falsa, ofensiva o que no tenga relación con el seguimiento.',
            'Copiar, descargar, vender, ceder o explotar los datos de los adultos mayores para cualquier fin distinto del seguimiento y la asistencia comunitaria.',
            'Interferir con el funcionamiento o la seguridad de la plataforma, interceptar comunicaciones o modificar datos sin autorización.',
          ],
        },
        'Estas conductas pueden constituir delitos según la **Ley No. 53-07 sobre Crímenes y Delitos de Alta Tecnología**. El incumplimiento puede dar lugar a la desactivación inmediata de la cuenta y a las acciones legales que correspondan.',
      ],
    },
    {
      id: 'organizacion',
      titulo: '8. Obligaciones de la organización',
      bloques: [
        'La organización que usa CuidaRed es responsable de los datos que registra. En particular, debe:',
        {
          lista: [
            'Obtener y registrar el **consentimiento informado** del adulto mayor (o de su representante) antes de crear su perfil.',
            'Asignar a cada persona el rol mínimo necesario y revisar periódicamente las cuentas activas.',
            'Atender las solicitudes de acceso, rectificación, cancelación y oposición de los titulares de los datos.',
            'Activar el procedimiento de respuesta a incidentes descrito en la Política de Privacidad cuando ocurra un incidente.',
          ],
        },
      ],
    },
    {
      id: 'sin-conexion',
      titulo: '9. Uso sin conexión',
      bloques: [
        'Las visitas y necesidades pueden registrarse sin internet. Esos registros se guardan temporalmente en el dispositivo y se envían automáticamente al recuperar la conexión. Si un mismo registro cambió en el dispositivo y en el servidor, prevalece la modificación más reciente ("última escritura gana"). Mientras haya registros pendientes, no borres los datos del navegador ni cierres sesión sin sincronizar.',
      ],
    },
    {
      id: 'propiedad',
      titulo: '10. Propiedad intelectual, marcas y licencias',
      bloques: [
        `El diseño arquitectónico, el código fuente, las interfaces y la documentación de CuidaRed son propiedad intelectual del equipo de estudiantes creadores (${PRODUCTO.equipo}), desarrollados en el marco del ${PRODUCTO.institucion} en ${PRODUCTO.anio}. Queda restringida su reproducción o distribución no autorizada.`,
        'El nombre, el logotipo y cualquier variante gráfica del INTEC son propiedad exclusiva de dicha institución y se utilizan únicamente en un contexto académico. El nombre "CuidaRed" y su logotipo representan la identidad visual del proyecto estudiantil y no constituyen una marca comercial registrada en esta etapa.',
        'CuidaRed utiliza componentes de terceros de código abierto (por ejemplo React, React Router, Vite, Tailwind CSS y Lucide) bajo sus respectivas licencias; el detalle está en la pantalla "Acerca de CuidaRed".',
      ],
    },
    {
      id: 'terminacion',
      titulo: '11. Suspensión y terminación de la cuenta',
      bloques: [
        'El administrador puede desactivar o eliminar cuentas de su organización; una cuenta desactivada pierde el acceso de inmediato. Los voluntarios y familiares responsables pueden eliminar su propia cuenta desde **Mi perfil → Editar perfil**, previa confirmación. Los administradores y coordinadores deben solicitarlo a su organización. Los registros históricos (visitas, necesidades y registro de actividades) se conservan según la política de retención.',
      ],
    },
    {
      id: 'cambios',
      titulo: '12. Cambios en estos términos',
      bloques: [
        'Estos términos pueden actualizarse. Los cambios relevantes se informarán en la plataforma antes de entrar en vigor y la fecha de la última actualización aparece al final de este documento.',
      ],
    },
    {
      id: 'ley',
      titulo: '13. Legislación aplicable',
      bloques: [
        'Estos términos se rigen por las leyes de la República Dominicana, en particular:',
        {
          lista: [
            'Constitución de la República Dominicana, artículos 44 (derecho a la intimidad y al honor personal) y 57 (protección de las personas de la tercera edad).',
            'Ley No. 172-13 sobre Protección Integral de los Datos Personales.',
            'Ley No. 352-98 sobre Protección de la Persona Envejeciente.',
            'Ley No. 53-07 sobre Crímenes y Delitos de Alta Tecnología.',
            'Ley General de Salud No. 42-01, en lo relativo a la confidencialidad de la información de salud.',
          ],
        },
      ],
    },
    {
      id: 'contacto',
      titulo: '14. Contacto',
      bloques: [
        `Para dudas sobre tu cuenta o tus datos, comunícate primero con el administrador de tu organización. Para asuntos sobre la plataforma, contacta al ${PRODUCTO.equipo} a través del ${PRODUCTO.institucion}.`,
      ],
    },
  ],
  actualizado: ACTUALIZADO,
}

/* ═════════════════════════════ POLÍTICA DE PRIVACIDAD ═════════════════════════════ */
export const POLITICA: Documento = {
  titulo: 'Política de Privacidad',
  resumen:
    'Esta política explica **qué datos trata CuidaRed, para qué, quién puede verlos, cuánto tiempo se guardan y cómo puedes ejercer tus derechos**. CuidaRed se diseñó con privacidad desde el diseño porque acompaña a personas adultas mayores en situación de vulnerabilidad.',
  secciones: [
    {
      id: 'alcance',
      titulo: '1. Alcance y responsables',
      bloques: [
        'Esta política se aplica a los datos de las personas usuarias (administradores, coordinadores, voluntarios y familiares responsables) y de los adultos mayores registrados en CuidaRed.',
        'Cada **organización** que usa CuidaRed es responsable de los datos que registra y de atender a los titulares. El equipo de CuidaRed provee la herramienta y aplica las medidas técnicas descritas aquí.',
        {
          aviso: `Versión de demostración ${PRODUCTO.version}: en este MVP académico no existe todavía un servidor central. Los datos se guardan solo en el navegador del dispositivo donde se usa la aplicación. No registres datos reales de personas en esta versión.`,
          tono: 'warning',
        },
      ],
    },
    {
      id: 'principios',
      titulo: '2. Principios que seguimos',
      bloques: [
        {
          lista: [
            '**Finalidad:** los datos se usan solo para el seguimiento comunitario, la identificación de necesidades, la gestión de visitas, la generación de alertas y las actividades definidas en CuidaRed.',
            '**Minimización:** solo se piden los datos necesarios para cada función; no se solicita información por conveniencia técnica o administrativa.',
            '**Confidencialidad:** quienes usan CuidaRed tratan la información como confidencial y solo la comparten por los canales y para los fines autorizados.',
            '**No discriminación:** la edad, la condición social o económica, la salud o la vulnerabilidad nunca se usan para excluir o perjudicar a nadie.',
            '**Respeto a la dignidad:** la clasificación de riesgo y las alertas son herramientas de apoyo al cuidado, no etiquetas para estigmatizar.',
            '**Seguridad y responsabilidad:** se aplican medidas para evitar pérdidas, accesos o cambios no autorizados, y cada persona responde por el uso que hace de la información.',
          ],
        },
      ],
    },
    {
      id: 'datos',
      titulo: '3. Qué datos tratamos',
      bloques: [
        { sub: 'De las personas usuarias', texto: 'Nombre, apellido, cédula, correo electrónico, teléfono, rol, organización y, si la añades, una foto de perfil. La contraseña nunca se guarda: solo una huella cifrada (hash) que no permite recuperarla.' },
        {
          sub: 'De los adultos mayores',
          texto:
            'Datos de identificación y contacto (nombre, cédula, fecha de nacimiento, sexo, teléfono, zona y municipio), contacto de emergencia, condición general (grado de autonomía y condiciones elegidas de una lista predefinida, con una nota breve opcional), nivel de riesgo social, constancia del consentimiento, y el historial de visitas, necesidades y alertas.',
        },
        { sub: 'Registro de actividades', texto: 'Quién hizo cada operación relevante, cuándo, sobre qué registro y con qué resultado.' },
        {
          sub: 'Lo que NO recopilamos',
          texto:
            'Historias clínicas, diagnósticos detallados, tratamientos, resultados de laboratorio u otra información clínica detallada (Ley General de Salud No. 42-01); ubicación GPS en tiempo real; datos bancarios; ni información sin una finalidad identificada.',
        },
      ],
    },
    {
      id: 'finalidad',
      titulo: '4. Para qué usamos los datos',
      bloques: [
        {
          lista: [
            'Identificar a las personas usuarias e iniciar sesión de forma segura.',
            'Habilitar a cada persona las funciones que corresponden a su rol.',
            'Registrar y consultar perfiles, visitas y necesidades de los adultos mayores.',
            'Generar alertas automáticas (riesgo alto, medicamentos pendientes o muchos días sin visita).',
            'Preparar el resumen de seguimiento y reportes estadísticos para la organización.',
            'Mantener la trazabilidad de las operaciones y responder a incidentes.',
          ],
        },
        'Queda prohibido usar, ceder, vender o explotar la información de los adultos mayores para cualquier fin distinto del seguimiento y la asistencia comunitaria. CuidaRed no usa los datos con fines publicitarios ni los comparte con terceros ajenos a la organización.',
      ],
    },
    {
      id: 'consentimiento',
      titulo: '5. Consentimiento informado',
      bloques: [
        'Antes de crear el perfil de un adulto mayor, la organización debe explicarle (a él o a su representante) qué datos se registrarán y para qué, y obtener su **consentimiento informado** conforme a la Ley No. 172-13. CuidaRed guarda quién otorgó el consentimiento, la fecha y quién lo registró.',
        'Las personas usuarias dan su consentimiento al aceptar estos documentos cuando activan su cuenta. El consentimiento puede retirarse en cualquier momento solicitándolo a la organización; desde entonces sus datos dejan de usarse y se desactivan, anonimizan o eliminan según corresponda.',
      ],
    },
    {
      id: 'acceso',
      titulo: '6. Quién puede ver qué',
      bloques: [
        'CuidaRed aplica control de acceso basado en roles (RBAC). La autorización se comprueba en la interfaz y otra vez en los servicios antes de leer o modificar cualquier dato; ocultar un botón no se considera suficiente. Todo usuario solo ve datos de su propia organización.',
        {
          tabla: {
            cabecera: ['Rol', 'Acceso'],
            filas: [
              ['Administrador', 'Usuarios y configuración de su organización, todos los perfiles, alertas, resumen, reportes y registro de actividades. Es el único que puede anonimizar perfiles.'],
              ['Coordinador', 'Todos los perfiles de su organización, visitas, necesidades, alertas, resumen y reportes. No gestiona usuarios ni ve el registro de actividades.'],
              ['Voluntario', 'Solo los adultos mayores que tiene asignados y la información necesaria para visitarlos y registrar sus necesidades.'],
              ['Familiar responsable', 'Solo los adultos mayores a su cargo (vínculo de familiar responsable): historial de visitas y estado de las necesidades. Únicamente consulta.'],
            ],
          },
        },
        {
          sub: 'Privacidad del familiar responsable',
          texto:
            'El familiar responsable no puede consultar información de otros adultos mayores, de otros familiares, de los usuarios internos de la organización ni de casos que no estén relacionados con su responsabilidad.',
        },
        {
          sub: 'Datos sensibles con acceso superior',
          texto:
            'La evaluación de riesgo, la condición general y la situación socioeconómica, así como cualquier información sobre salud, vulnerabilidad, abandono, maltrato o ubicación, tienen controles más estrictos: solo pueden verlas el administrador, el coordinador y el voluntario asignado al caso. El familiar responsable no accede a esos detalles.',
        },
      ],
    },
    {
      id: 'seguridad',
      titulo: '7. Cómo protegemos los datos',
      bloques: [
        {
          lista: [
            'Las contraseñas se guardan como hash con sal (PBKDF2-SHA256) y nunca en texto plano. Se exige una política de contraseñas robustas.',
            'Bloqueo temporal tras 5 intentos fallidos y mensajes de error genéricos que no revelan si un correo está registrado.',
            'Las sesiones expiran por inactividad (30 minutos) o duración máxima (12 horas) y se invalidan si la cuenta se desactiva o elimina.',
            'La recuperación de contraseña usa un código de un solo uso, guardado solo como hash y con caducidad de 15 minutos.',
            'Todos los datos que se reciben se validan (campos obligatorios, formatos, longitudes y permisos) antes de guardarse.',
            'En la versión de producción prevista por el proyecto, la autenticación se gestionará con Supabase Auth y todas las comunicaciones viajarán cifradas mediante HTTPS/TLS 1.2 o superior.',
          ],
        },
        'Estas medidas buscan prevenir accesos ilícitos, modificaciones no autorizadas e interceptación de información, conforme a la Ley No. 53-07 sobre Crímenes y Delitos de Alta Tecnología.',
      ],
    },
    {
      id: 'auditoria',
      titulo: '8. Registro de actividades (auditoría)',
      bloques: [
        'Las operaciones relevantes quedan registradas con: **usuario** que la realizó, **fecha y hora**, **tipo de operación**, **registro afectado** y **resultado** (éxito, fallo o acceso denegado). Se registran, entre otras, los inicios y cierres de sesión, los intentos fallidos, la creación y edición de perfiles y usuarios, las visitas, las necesidades, las alertas y la sincronización.',
        'El registro no guarda contraseñas ni información clínica, no puede modificarse ni borrarse desde la aplicación y solo el administrador puede consultarlo. Sirve para la trazabilidad y para investigar accesos o cambios no autorizados.',
      ],
    },
    {
      id: 'offline',
      titulo: '9. Datos sin conexión',
      bloques: [
        {
          lista: [
            'Sin internet solo se pueden guardar visitas y necesidades. Se almacenan temporalmente en el dispositivo, asociadas a la persona que las registró, y solo ella las ve.',
            'Al recuperar la conexión se envían automáticamente al servidor y **se eliminan del dispositivo** una vez sincronizadas.',
            'Si un registro cambió en el dispositivo y en el servidor, prevalece la modificación más reciente según su hora (UTC).',
            'Protege tu teléfono con bloqueo de pantalla y no compartas el dispositivo con la sesión abierta.',
          ],
        },
      ],
    },
    {
      id: 'retencion',
      titulo: '10. Política de retención y eliminación',
      bloques: [
        'Los datos no se conservan indefinidamente. Estos son los plazos:',
        {
          tabla: {
            cabecera: ['Información', 'Plazo y destino'],
            filas: [
              ['Cuentas de usuario', 'Mientras la persona colabore con la organización. Al eliminarse la cuenta se borran sus datos personales.'],
              ['Perfiles de adultos mayores activos', 'Mientras se mantenga el seguimiento y el consentimiento.'],
              ['Perfiles inactivos', 'Si un perfil permanece inactivo por **más de 24 meses**, se anonimiza: se eliminan nombre, cédula, teléfono, dirección, contacto de emergencia y foto, y solo se conservan datos estadísticos sin identificar a la persona.'],
              ['Registro de actividades (auditoría)', 'Se conserva **5 años** desde la fecha de cada entrada y luego se elimina.'],
              ['Datos guardados sin conexión', 'Se eliminan del dispositivo **al sincronizarse** con el servidor.'],
              ['Códigos de recuperación de contraseña', 'Caducan a los 15 minutos, son de un solo uso y se eliminan en un plazo máximo de 24 horas.'],
              ['Borradores de formularios', 'Se guardan solo durante la sesión del navegador y se borran al cerrarlo o al guardar.'],
            ],
          },
        },
      ],
    },
    {
      id: 'derechos',
      titulo: '11. Tus derechos y cómo ejercerlos',
      bloques: [
        'Conforme a la Ley No. 172-13, toda persona titular de datos tiene derecho a:',
        {
          lista: [
            '**Acceso:** saber qué datos suyos se tratan y para qué.',
            '**Rectificación:** corregir datos inexactos o incompletos.',
            '**Cancelación (supresión):** pedir que se eliminen sus datos cuando ya no sean necesarios o retire su consentimiento.',
            '**Oposición:** oponerse a un tratamiento concreto por motivos legítimos.',
          ],
        },
        { sub: 'Si tienes una cuenta', texto: 'Consulta y corrige tus datos en **Mi perfil**. Los voluntarios y familiares responsables pueden eliminar su propia cuenta desde **Editar perfil**. Para todo lo demás, dirígete al administrador de tu organización.' },
        {
          sub: 'Si eres un adulto mayor registrado o su representante',
          texto:
            'Haz la solicitud ante la organización que te acompaña (al coordinador o al administrador), de forma verbal o escrita, identificándote como titular o representante. La organización debe responder sin costo, dentro de los plazos que establece la ley, y dejar constancia de la solicitud y de la respuesta.',
        },
        'Si consideras que tus derechos no fueron atendidos, puedes acudir a las vías previstas en la Ley No. 172-13.',
      ],
    },
    {
      id: 'incidentes',
      titulo: '12. Procedimiento ante incidentes de privacidad',
      bloques: [
        'Si detectas o sospechas un acceso no autorizado, una pérdida, una exposición o una modificación indebida de información (por ejemplo, un teléfono perdido con la sesión abierta), **avisa de inmediato al administrador de tu organización**. Se activará este procedimiento:',
        { lista: PASOS_INCIDENTE, ordenada: true },
      ],
    },
    {
      id: 'adultos-mayores',
      titulo: '13. Protección de las personas adultas mayores',
      bloques: [
        'CuidaRed se alinea con la **Ley No. 352-98 sobre Protección de la Persona Envejeciente** y con el **artículo 57 de la Constitución**, que reconocen la protección integral de las personas mayores, su dignidad, su libertad y su convivencia familiar y comunitaria. La información debe contribuir a su seguimiento y protección, sin generar riesgos adicionales para su privacidad, dignidad o seguridad.',
        'El **artículo 44 de la Constitución** garantiza el derecho a la intimidad y al honor personal, y la **Ley No. 42-01** protege la confidencialidad de la información de salud; por eso CuidaRed no guarda información clínica detallada y restringe el acceso a los datos de salud que sí necesita.',
      ],
    },
    {
      id: 'terceros',
      titulo: '14. Cesión de datos e integraciones',
      bloques: [
        'CuidaRed no cede datos a terceros. En esta versión no existen integraciones con instituciones de salud, organismos públicos u otras organizaciones. Cualquier integración futura deberá usar canales seguros, autenticar a los sistemas participantes, limitar los datos a lo estrictamente necesario, tener una finalidad clara, aplicar controles de autorización y registrar las operaciones, y será evaluada técnica, ética y legalmente antes de implementarse. Una integración nunca supone autorización automática para compartir datos.',
      ],
    },
    {
      id: 'cambios-politica',
      titulo: '15. Cambios en esta política',
      bloques: ['Esta política puede actualizarse. Los cambios relevantes se informarán en la plataforma antes de entrar en vigor.'],
    },
    {
      id: 'marco-legal',
      titulo: '16. Marco legal',
      bloques: [
        {
          lista: [
            'Constitución de la República Dominicana, artículos 44 y 57.',
            'Ley No. 172-13 sobre Protección Integral de los Datos Personales.',
            'Ley No. 352-98 sobre Protección de la Persona Envejeciente.',
            'Ley No. 53-07 sobre Crímenes y Delitos de Alta Tecnología.',
            'Ley General de Salud No. 42-01.',
          ],
        },
        `CuidaRed es un proyecto académico desarrollado por el ${PRODUCTO.equipo} en el ${PRODUCTO.institucion} (${PRODUCTO.curso}).`,
      ],
    },
  ],
  actualizado: ACTUALIZADO,
}
