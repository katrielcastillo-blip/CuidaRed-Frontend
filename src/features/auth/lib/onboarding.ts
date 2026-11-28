/*
 * onboarding.ts — Contenido de la guía inicial por rol y tipo de cuenta, y marca de "guía vista".
 * Módulo: auth (feedback de PM sobre LOGIN SCREEN: onboarding para explicar el funcionamiento).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Funciones puras (sin React ni store): el contenido depende del rol de la membresía activa, del tipo de cuenta
 * (Familia u Organización, Reglas de Negocio V2 §Cuenta) y de si la cuenta está en prueba gratuita.
 * La guía se marca como vista en localStorage con la clave `cuidared:onboarding:<userId>:<rol>`: cada rol que
 * una persona tiene en sus distintas cuentas ve su propia guía una sola vez por dispositivo.
 */
import { DIAS_PRUEBA_GRATUITA, type TipoCuenta } from '@/domain/planes'
import type { Rol } from '@/domain/types'

/** Iconos disponibles para los pasos (el componente los asocia a íconos de lucide-react). */
export type IconoGuia = 'bienvenida' | 'equipo' | 'adultos' | 'visita' | 'alerta' | 'sinConexion' | 'plan' | 'privacidad' | 'emergencia' | 'indicaciones'

export interface PasoGuia {
  icono: IconoGuia
  titulo: string
  texto: string
}

export interface GuiaInicial {
  /** Texto que identifica el rol y la cuenta, bajo el título del diálogo. */
  contexto: string
  pasos: PasoGuia[]
}

export interface ContextoGuia {
  rol: Rol
  tipo: TipoCuenta
  nombreCuenta?: string
  /** La cuenta está en su prueba gratuita vigente. */
  enPrueba?: boolean
  /** Días que le quedan a la prueba (solo si `enPrueba`). */
  diasPrueba?: number
}

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  cuidador: 'Cuidador',
  familiar: 'Familiar responsable',
  voluntario: 'Voluntario',
}

/** Aviso que cierra la guía de los roles que no registran emergencias. */
const EMERGENCIA: PasoGuia = {
  icono: 'emergencia',
  titulo: 'En una emergencia, llama al 9-1-1',
  texto: 'CuidaRed apoya la coordinación y el seguimiento comunitario. No sustituye servicios médicos ni de emergencia.',
}

/** Paso sobre la prueba gratuita o, si la cuenta ya tiene plan, sobre dónde consultarlo. */
function pasoPlan({ enPrueba, diasPrueba }: ContextoGuia): PasoGuia {
  if (enPrueba) {
    const dias = diasPrueba != null && diasPrueba > 0 ? `Te quedan ${diasPrueba} ${diasPrueba === 1 ? 'día' : 'días'} de los ${DIAS_PRUEBA_GRATUITA} de prueba gratuita. ` : `Tienes ${DIAS_PRUEBA_GRATUITA} días de prueba gratuita. `
    return {
      icono: 'plan',
      titulo: 'Tu prueba gratuita',
      texto: `${dias}Durante la prueba algunas funciones son limitadas. Cuando esté por terminar, en «Plan y suscripción» podrás elegir el plan que necesites.`,
    }
  }
  return {
    icono: 'plan',
    titulo: 'Plan y suscripción',
    texto: 'En «Plan y suscripción» consultas tu plan, cuánto has usado de sus límites y tus pagos.',
  }
}

/** Contenido de la guía para un rol y un tipo de cuenta. Siempre de 3 a 4 pasos. */
export function guiaPara(c: ContextoGuia): GuiaInicial {
  const cuenta = c.tipo === 'familia' ? 'tu familia' : 'tu organización'
  const contexto = `${ETIQUETA_ROL[c.rol]}${c.nombreCuenta ? ` · ${c.nombreCuenta}` : ''}`

  switch (c.rol) {
    case 'admin':
      return {
        contexto,
        pasos: [
          { icono: 'bienvenida', titulo: 'Te damos la bienvenida', texto: `Eres la persona titular de la cuenta de ${cuenta}. Desde aquí coordinas el cuidado de los adultos mayores de tu comunidad.` },
          { icono: 'equipo', titulo: 'Arma tu equipo', texto: 'En Miembros invitas a coordinadores, cuidadores, voluntarios y familiares. Cada persona recibe un código para activar su cuenta y elige su propia contraseña.' },
          { icono: 'adultos', titulo: 'Registra y da seguimiento', texto: 'Registra a los adultos mayores, asigna a quienes los visitan y revisa las alertas de riesgo y las solicitudes de visita de personas externas.' },
          pasoPlan(c),
        ],
      }
    case 'coordinador':
      if (c.tipo === 'familia') {
        return {
          contexto,
          pasos: [
            { icono: 'bienvenida', titulo: 'Te damos la bienvenida', texto: `Eres la persona titular de la cuenta de ${cuenta}: coordinas el cuidado y decides quién tiene acceso.` },
            { icono: 'adultos', titulo: 'Registra a tus adultos mayores', texto: 'Crea el perfil de cada persona mayor con su información de salud y sus contactos de emergencia. Podrás programar visitas y tareas.' },
            { icono: 'equipo', titulo: 'Invita a quienes ayudan', texto: 'Invita a cuidadores y familiares. Un familiar solo ve a las personas mayores para las que tú le des permiso explícito.' },
            pasoPlan(c),
          ],
        }
      }
      return {
        contexto,
        pasos: [
          { icono: 'bienvenida', titulo: 'Te damos la bienvenida', texto: `Como coordinador supervisas el seguimiento de los adultos mayores de ${cuenta} y mantienes al equipo en sintonía.` },
          { icono: 'adultos', titulo: 'Adultos mayores y equipo', texto: 'Registra perfiles, asigna cuidadores y voluntarios, programa visitas y crea tareas con su agenda.' },
          { icono: 'alerta', titulo: 'Alertas y visitantes', texto: 'Atiende las alertas de riesgo y autoriza o rechaza las solicitudes de visita de personas externas.' },
          { icono: 'sinConexion', titulo: 'También sin internet', texto: 'Las visitas y necesidades que registres sin conexión se guardan en el dispositivo y se sincronizan al volver la red.' },
        ],
      }
    case 'cuidador':
      return {
        contexto,
        pasos: [
          { icono: 'bienvenida', titulo: 'Te damos la bienvenida', texto: `Eres quien acompaña día a día a los adultos mayores de ${cuenta} que tienes asignados.` },
          { icono: 'visita', titulo: 'Registra cada visita', texto: 'Anota cómo encontraste a la persona con listas de verificación y observaciones breves. Agrega fotos como evidencia cuando haga falta.' },
          { icono: 'indicaciones', titulo: 'Necesidades, indicaciones y tareas', texto: 'Registra lo que la persona necesita, consulta sus indicaciones médicas y completa las tareas de tu agenda.' },
          { icono: 'sinConexion', titulo: 'También sin internet', texto: 'Lo que registres sin conexión se guarda en el dispositivo y se sincroniza solo. Si hay una emergencia, llama al 9-1-1.' },
        ],
      }
    case 'familiar':
      return {
        contexto,
        pasos: [
          { icono: 'bienvenida', titulo: 'Te damos la bienvenida', texto: `Desde aquí acompañas a tu familiar y sigues su cuidado en ${cuenta}, sin tener que preguntar a cada persona.` },
          { icono: 'visita', titulo: 'Visitas y necesidades', texto: 'Consulta cuándo lo visitaron, cómo estaba y qué necesita. Verás solo a las personas mayores para las que recibiste permiso.' },
          { icono: 'indicaciones', titulo: 'Solo consulta', texto: 'Puedes ver sus indicaciones médicas, pero no modificar registros. Si notas algo, avísale a la persona que coordina.' },
          EMERGENCIA,
        ],
      }
    case 'voluntario':
      return {
        contexto,
        pasos: [
          { icono: 'bienvenida', titulo: 'Te damos la bienvenida', texto: `Gracias por acompañar a los adultos mayores de ${cuenta}. Tu visita es una parte muy importante del cuidado.` },
          { icono: 'visita', titulo: 'Tus visitas', texto: 'Verás las personas que tienes asignadas y las visitas programadas para ti.' },
          { icono: 'adultos', titulo: 'Después de visitar', texto: 'Registra que la visita ocurrió y deja una observación breve de cómo te fue. Funciona también sin internet.' },
          { icono: 'privacidad', titulo: 'Privacidad ante todo', texto: 'No verás información médica ni necesidades. Lo que conoces de cada persona es confidencial: no lo compartas.' },
        ],
      }
  }
}

/* ───────────── Marca de "guía vista" (localStorage) ───────────── */

export const claveOnboarding = (userId: string, rol: Rol) => `cuidared:onboarding:${userId}:${rol}`

/** ¿La guía ya se vio en este dispositivo? Si el almacenamiento no está disponible se considera vista (no se insiste). */
export function onboardingVisto(clave: string): boolean {
  try {
    return localStorage.getItem(clave) !== null
  } catch {
    return true
  }
}

export function marcarOnboardingVisto(clave: string) {
  try {
    localStorage.setItem(clave, new Date().toISOString())
  } catch {
    /* sin almacenamiento: la guía no se repetirá en esta sesión porque el componente recuerda que se cerró */
  }
}
