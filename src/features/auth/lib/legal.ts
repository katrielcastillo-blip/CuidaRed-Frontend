/** Textos legales (Figma "Pantalla Términos" 275:465 y "Pantalla Política" 298:457). */

/** Fragmento de párrafo: texto normal o resaltado (negrita). */
export type Fragmento = string | { b: string }

export interface Subseccion {
  titulo: string
  texto: string
}

export interface Seccion {
  titulo: string
  parrafos?: string[]
  subsecciones?: Subseccion[]
}

export interface Documento {
  titulo: string
  intro: Fragmento[]
  secciones: Seccion[]
  actualizado: string
}

export const TERMINOS: Documento = {
  titulo: 'Términos y Condiciones',
  intro: [
    'El presente documento establece los ',
    { b: 'términos y condiciones' },
    ' de uso de la plataforma ',
    { b: 'CuidaRed' },
    '. Al crear una cuenta, el usuario declara haber leído y aceptado lo aquí establecido.',
  ],
  secciones: [
    {
      titulo: '1. Aceptación',
      parrafos: [
        'El acceso y uso de la plataforma CuidaRed implica la aceptación plena de los presentes Términos y Condiciones. En caso de no estar de acuerdo con lo aquí establecido, se recomienda abstenerse de utilizar la plataforma.',
      ],
    },
    {
      titulo: '2. Naturaleza del servicio',
      parrafos: [
        'CuidaRed es una herramienta de apoyo para el seguimiento comunitario de adultos mayores. La plataforma no sustituye servicios médicos, instituciones públicas ni organismos de emergencia. Ante cualquier situación de urgencia de salud, deberá contactarse de inmediato a los servicios médicos correspondientes.',
      ],
    },
    {
      titulo: '3. Responsabilidades por rol',
      subsecciones: [
        {
          titulo: 'Administrador y Coordinador',
          texto: 'Corresponde a estos roles la gestión de los usuarios de la organización o el grupo familiar, así como la correcta asignación de roles dentro del sistema.',
        },
        {
          titulo: 'Cuidador',
          texto: 'Corresponde a este rol el registro veraz de visitas y necesidades, incluso en condiciones sin conexión a internet.',
        },
        {
          titulo: 'Familiar Responsable',
          texto: 'Corresponde a este rol mantener actualizados los datos de contacto proporcionados al sistema. Su acceso es de carácter exclusivamente consultivo.',
        },
      ],
    },
    {
      titulo: '4. Uso adecuado de la plataforma',
      parrafos: [
        'Queda prohibido el uso indebido de la plataforma, la publicación de información falsa, así como cualquier acción que comprometa la seguridad de los datos registrados. El incumplimiento de esta disposición podrá resultar en la suspensión o eliminación de la cuenta.',
      ],
    },
    {
      titulo: '5. Limitaciones del servicio',
      parrafos: [
        'CuidaRed no garantiza la disponibilidad continua e ininterrumpida del servicio, y no asume responsabilidad alguna por decisiones médicas o de cuidado adoptadas con base en la información registrada en la plataforma.',
      ],
    },
    {
      titulo: '6. Terminación de cuenta',
      parrafos: ['La eliminación de la cuenta podrá solicitarse en cualquier momento a través del perfil del usuario, previa confirmación.'],
    },
    {
      titulo: '7. Marco legal aplicable',
      parrafos: [
        'El presente servicio se rige por la Ley No. 172-13 sobre Protección de Datos Personales y la Ley No. 352-98 sobre Protección de la Persona Envejeciente de la República Dominicana.',
      ],
    },
  ],
  actualizado: 'Última actualización: 21 de agosto de 2026',
}

export const POLITICA: Documento = {
  titulo: 'Política de Privacidad',
  intro: [
    'El presente documento describe la ',
    { b: 'Política de Privacidad' },
    ' de la plataforma ',
    { b: 'CuidaRed' },
    '. Al crear una cuenta, el usuario declara haber leído y aceptado el tratamiento que se otorga a sus datos personales conforme a lo aquí establecido.',
  ],
  secciones: [
    {
      titulo: '1. Objeto',
      parrafos: [
        'La presente Política de Privacidad describe el tratamiento que se otorga a los datos personales recolectados a través de la plataforma CuidaRed, en cumplimiento de la normativa vigente en materia de protección de datos.',
      ],
    },
    {
      titulo: '2. Datos recolectados',
      parrafos: [
        'La plataforma recolecta los datos proporcionados durante el registro de cuenta, tales como nombre, correo electrónico y número de teléfono. Asimismo, recolecta la información registrada en relación con el seguimiento del adulto mayor, incluyendo perfiles, historial de visitas, necesidades reportadas y observaciones asociadas.',
      ],
    },
    {
      titulo: '3. Finalidad del tratamiento',
      parrafos: [
        'Los datos recolectados se utilizan exclusivamente para el funcionamiento de la plataforma, incluyendo la autenticación del usuario, la habilitación de las funcionalidades correspondientes a su rol, y la coordinación del seguimiento comunitario dentro de la organización o el grupo familiar correspondiente.',
      ],
    },
    {
      titulo: '4. Acceso a la información',
      parrafos: [
        'El acceso a los datos registrados está restringido a los usuarios autorizados dentro de la organización o el grupo familiar correspondiente, conforme a los permisos asignados a cada rol. La plataforma no comercializa ni comparte datos personales con terceros ajenos a dicha organización o grupo familiar.',
      ],
    },
    {
      titulo: '5. Medidas de seguridad',
      parrafos: [
        'Las contraseñas se almacenan mediante mecanismos de cifrado (bcrypt) y no se conservan en texto legible. El acceso a la plataforma se gestiona mediante autenticación segura basada en tokens (JWT), y la totalidad de la información transmitida entre el dispositivo del usuario y los servidores se protege mediante cifrado TLS.',
      ],
    },
    {
      titulo: '6. Tratamiento de datos sin conexión a internet',
      parrafos: [
        'En caso de utilizarse la plataforma sin conexión a internet, los registros correspondientes se almacenan de manera temporal en el dispositivo del usuario, sincronizándose automáticamente con los servidores de CuidaRed al restablecerse la conexión.',
      ],
    },
    {
      titulo: '7. Derechos del titular de los datos',
      parrafos: [
        'De conformidad con la Ley No. 172-13 sobre Protección de Datos Personales de la República Dominicana, el titular de los datos tiene derecho a acceder, rectificar y solicitar la eliminación de su información personal. Estos derechos podrán ejercerse a través del perfil del usuario o mediante los canales de contacto disponibles en la plataforma.',
      ],
    },
    {
      titulo: '8. Conservación de datos',
      parrafos: [
        'Los datos personales se conservarán mientras la cuenta del usuario permanezca activa, o mientras sea necesario para cumplir con la finalidad para la cual fueron recolectados.',
      ],
    },
    {
      titulo: '9. Modificaciones a esta política',
      parrafos: [
        'La presente Política de Privacidad podrá ser modificada en el futuro. Cualquier cambio será notificado a través de la plataforma antes de su entrada en vigencia.',
      ],
    },
    {
      titulo: '10. Marco legal aplicable',
      parrafos: [
        'El tratamiento de los datos personales se rige por la Ley No. 172-13 sobre Protección de Datos Personales y la Ley No. 352-98 sobre Protección de la Persona Envejeciente de la República Dominicana.',
      ],
    },
  ],
  actualizado: 'Última actualización: 21 de agosto de 2026',
}
