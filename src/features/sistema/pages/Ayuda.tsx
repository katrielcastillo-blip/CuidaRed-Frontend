/*
 * Ayuda.tsx — Ayuda en línea: guía rápida en lenguaje claro, adaptada a lo que puede hacer cada rol.
 * Módulo: sistema (SRS §8.2.2.1.8 Documentación · §8.2.2.1.8.2 Ayuda en línea · RF-04 · RF-05 · RF-09 · RF-10 ·
 * §18.4 indicadores de riesgo). El umbral RF-05 y el contacto institucional se leen de los parámetros de la
 * cuenta (Parametros + Configuracion_Cuenta) con configOrg.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  BellRing,
  CalendarPlus,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Eye,
  HandHeart,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  Siren,
  UserCog,
  UserPlus,
  UserRound,
  WifiOff,
} from 'lucide-react'
import { RiesgoBadge } from '@/components/ui'
import { ROL_LABEL, useSession } from '@/domain/auth'
import { DESCRIPCION_ROL, puede, type Accion } from '@/domain/permisos'
import { configOrg } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'

interface Tema {
  id: string
  titulo: string
  icono: ReactNode
  /** Se muestra si el rol tiene este permiso (o si la función devuelve true). */
  visible: Accion | ((u: Usuario) => boolean)
  contenido: ReactNode
}

const ENLACE = 'inline-flex min-h-12 items-center font-semibold text-navy underline underline-offset-[3px]'

function Pasos({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2 pl-6 list-decimal marker:font-bold marker:text-navy">
      {items.map((t, i) => (
        <li key={i} className="pl-1 text-pretty">
          {t}
        </li>
      ))}
    </ol>
  )
}

function Puntos({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2 pl-6 list-disc marker:text-blue">
      {items.map((t, i) => (
        <li key={i} className="pl-1 text-pretty">
          {t}
        </li>
      ))}
    </ul>
  )
}

function temas(base: string, dias: number): Tema[] {
  return [
    {
      id: 'visita',
      titulo: 'Cómo registrar una visita',
      icono: <ClipboardCheck size={20} />,
      visible: 'visitas:registrar',
      contenido: (
        <>
          <Pasos
            items={[
              <>Abre <strong>Visitas</strong> (o el perfil del adulto mayor) y toca la visita de hoy o <strong>Registrar visita</strong>.</>,
              'Si estás en la casa, toca "Iniciar visita": se guarda la hora de llegada.',
              'Marca en la lista lo que revisaste (alimentación, medicamentos, ánimo…) y elige cómo encontraste a la persona.',
              'Escribe observaciones breves. Puedes usar abreviaturas; el botón "?" de cada campo te explica qué poner.',
              'Toca "Guardar". Verás un mensaje de confirmación y la visita aparecerá en el historial.',
            ]}
          />
          <p className="text-sm text-muted">Si ves que falta algo (medicinas, comida, transporte), registra también una necesidad.</p>
        </>
      ),
    },
    {
      id: 'necesidad',
      titulo: 'Cómo registrar una necesidad',
      icono: <HandHeart size={20} />,
      visible: 'necesidades:registrar',
      contenido: (
        <>
          <Pasos
            items={[
              <>Entra en el perfil del adulto mayor y toca <strong>Registrar necesidad</strong>.</>,
              'Elige el tipo: medicamentos, alimentación, transporte, compañía u otros.',
              'Describe en pocas palabras qué hace falta y toca "Guardar". Se registra como "Pendiente".',
              'Cuando alguien se ocupe, cambia el estado a "En proceso" y, al resolverse, a "Satisfecha". Queda el historial de cada cambio.',
            ]}
          />
          <p className="text-sm text-muted">Una necesidad de medicamentos pendiente genera una alerta prioritaria automáticamente.</p>
        </>
      ),
    },
    {
      id: 'consultar',
      titulo: 'Cómo consultar visitas y necesidades',
      icono: <Eye size={20} />,
      visible: (u) => puede(u, 'visitas:ver') && !puede(u, 'visitas:registrar'),
      contenido: (
        <Puntos
          items={[
            'En el inicio verás al adulto mayor a tu cargo, su última visita y las necesidades abiertas.',
            'Abre su perfil para ver el historial completo de visitas, con fecha, responsable y observaciones.',
            'En "Necesidades" verás el estado de cada una: Pendiente, En proceso o Satisfecha.',
            'Tu acceso es de consulta: si ves algo que corregir o una situación urgente, comunícate con la organización.',
          ]}
        />
      ),
    },
    {
      id: 'perfiles',
      titulo: 'Perfiles de adultos mayores',
      icono: <UserPlus size={20} />,
      visible: 'adultos:crear',
      contenido: (
        <Puntos
          items={[
            <>Antes de crear un perfil, explica a la persona (o a su representante) qué datos se guardarán y para qué, y registra su <strong>consentimiento</strong>.</>,
            'Llena solo lo necesario: identificación, contacto, contacto de emergencia y condición general con las listas. No anotes diagnósticos ni historia clínica.',
            'Asigna el nivel de riesgo y, si lo necesitas, completa la evaluación de riesgo para recalcularlo.',
            'Asigna uno o más voluntarios para que puedan visitarlo y registrar sus necesidades.',
          ]}
        />
      ),
    },
    {
      id: 'programar',
      titulo: 'Programar visitas',
      icono: <CalendarPlus size={20} />,
      visible: 'visitas:programar',
      contenido: (
        <Puntos
          items={[
            'En Visitas toca "Programar visita", elige el adulto mayor, el voluntario, el día y la hora.',
            'Puedes añadir instrucciones previas (por ejemplo, "verificar toma de medicamentos").',
            'El voluntario verá la visita en su lista del día.',
          ]}
        />
      ),
    },
    {
      id: 'offline',
      titulo: 'Trabajar sin conexión y sincronizar',
      icono: <WifiOff size={20} />,
      visible: 'sync:usar',
      contenido: (
        <>
          <Puntos
            items={[
              'Sin internet puedes seguir registrando visitas y necesidades. La barra superior te avisa que estás sin conexión.',
              <>
                Lo que guardes se marca como <strong>"Pendiente de sincronización"</strong> y solo queda en tu teléfono.
              </>,
              'Al volver la conexión, CuidaRed lo envía solo. También puedes hacerlo a mano desde "Conexión y sincronización".',
              'Si el mismo registro cambió en tu teléfono y en el servidor, se queda la versión más reciente.',
              'No borres los datos del navegador ni cierres sesión con registros pendientes: podrías perderlos.',
            ]}
          />
          <Link to={`${base}/sincronizacion`} className={ENLACE}>
            Ir a Conexión y sincronización
          </Link>
        </>
      ),
    },
    {
      id: 'riesgo',
      titulo: 'Qué significan los colores y formas del riesgo',
      icono: <ShieldCheck size={20} />,
      visible: 'adultos:ver',
      contenido: (
        <>
          <p>Cada nivel tiene un color y una forma distintos, para reconocerlo de un vistazo aunque no se lea el texto:</p>
          <ul className="flex flex-col gap-3">
            <li className="flex items-start gap-3">
              <RiesgoBadge riesgo="alto" />
              <span>Triángulo rojo: necesita atención prioritaria.</span>
            </li>
            <li className="flex items-start gap-3">
              <RiesgoBadge riesgo="medio" />
              <span>Rombo ámbar: requiere seguimiento cercano.</span>
            </li>
            <li className="flex items-start gap-3">
              <RiesgoBadge riesgo="bajo" />
              <span>Círculo verde: situación estable.</span>
            </li>
          </ul>
          <p className="text-sm text-muted">El riesgo es una ayuda para organizar el cuidado, nunca una etiqueta sobre la persona.</p>
        </>
      ),
    },
    {
      id: 'alertas',
      titulo: 'Alertas automáticas',
      icono: <BellRing size={20} />,
      visible: 'alertas:ver',
      contenido: (
        <>
          <p>CuidaRed crea alertas por sí solo, sin que nadie tenga que hacerlo:</p>
          <Puntos
            items={[
              <>
                <strong>Caso prioritario</strong> (urgencia alta): cuando un adulto mayor tiene riesgo <strong>Alto</strong> o una necesidad de <strong>medicamentos pendiente</strong>. Si
                pasan las dos cosas, se crea una sola alerta.
              </>,
              <>
                <strong>Seguimiento</strong>: cuando un adulto mayor lleva <strong>más de {dias} días</strong> sin una visita registrada.
              </>,
              'Para atender una alerta, ábrela, anota lo que hiciste y cambia su estado: Pendiente → En atención → Atendida.',
              'Cuando la causa desaparece (por ejemplo, se registra la visita), la alerta se cierra sola.',
            ]}
          />
        </>
      ),
    },
    {
      id: 'resumen',
      titulo: 'Resumen de seguimiento',
      icono: <LayoutDashboard size={20} />,
      visible: 'resumen:ver',
      contenido: (
        <Puntos
          items={[
            'Muestra todos los casos activos de tu organización en un solo lugar.',
            'Ordénalos por prioridad (riesgo) o por estado de atención para ver primero lo más urgente.',
            'Se actualiza en cuanto cambia una visita, una necesidad o una alerta.',
          ]}
        />
      ),
    },
    {
      id: 'reportes',
      titulo: 'Reportes',
      icono: <BarChart3 size={20} />,
      visible: 'reportes:ver',
      contenido: (
        <Puntos
          items={[
            'Consulta cuántos adultos mayores hay registrados, las visitas realizadas por mes, las necesidades más frecuentes y los casos prioritarios.',
            'Úsalos para planificar visitas y recursos y para informar a tu organización.',
            'Los reportes muestran cifras de conjunto; no compartas fuera de la organización datos que identifiquen a las personas.',
          ]}
        />
      ),
    },
    {
      id: 'usuarios',
      titulo: 'Usuarios y roles',
      icono: <UserCog size={20} />,
      visible: 'usuarios:gestionar',
      contenido: (
        <>
          <Puntos
            items={[
              <>
                Crea la cuenta de cada persona en <strong>Miembros</strong>, con su rol. Si no le pones contraseña, queda como <strong>invitada</strong>: la persona entra en "Activar
                mi cuenta" desde la pantalla de inicio y elige su propia contraseña.
              </>,
              'Da a cada persona el rol mínimo que necesita. A los familiares asígnales solo los adultos mayores que tienen a su cargo.',
              'Si alguien deja de colaborar, desactiva su cuenta: pierde el acceso de inmediato.',
              'Debe haber siempre al menos un administrador activo.',
            ]}
          />
          <ul className="flex flex-col gap-2 rounded-sm bg-surface p-3 text-sm">
            {(['admin', 'coordinador', 'voluntario', 'familiar'] as const).map((r) => (
              <li key={r}>
                <strong className="text-navy">{ROL_LABEL[r]}:</strong> {DESCRIPCION_ROL[r]}
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      id: 'cuenta',
      titulo: 'Tu cuenta y tu contraseña',
      icono: <KeyRound size={20} />,
      visible: () => true,
      contenido: (
        <Puntos
          items={[
            'Cambia tu contraseña en Mi perfil → Cambiar contraseña. Debe tener 8 caracteres o más, con mayúscula, minúscula y número.',
            'Si la olvidas, en la pantalla de inicio toca "¿Olvidaste tu contraseña?": recibirás un código de 6 dígitos que vale 15 minutos.',
            'Después de 5 intentos fallidos el acceso se bloquea 5 minutos. La sesión se cierra sola tras 30 minutos sin uso.',
            'Nunca compartas tu contraseña, ni siquiera con el administrador.',
          ]}
        />
      ),
    },
    {
      id: 'privacidad',
      titulo: 'Privacidad y buen uso de la información',
      icono: <ShieldCheck size={20} />,
      visible: () => true,
      contenido: (
        <>
          <Puntos
            items={[
              'Usa la información solo para el seguimiento de los adultos mayores. No la compartas por mensajería, redes sociales ni con personas ajenas.',
              'Registra solo lo necesario. No anotes diagnósticos ni detalles clínicos.',
              'Trata siempre a las personas con respeto: el riesgo y las alertas son para ayudar, no para etiquetar.',
              'Si pierdes tu teléfono o ves un acceso extraño, avisa de inmediato al administrador.',
            ]}
          />
          <div className="flex flex-wrap gap-x-5">
            <Link to="/privacidad" className={ENLACE}>
              Política de Privacidad
            </Link>
            <Link to="/terminos" className={ENLACE}>
              Términos y Condiciones
            </Link>
          </div>
        </>
      ),
    },
  ]
}

export default function Ayuda() {
  const { user, org } = useSession()
  const { base } = useShell()
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  if (!user) return null
  const config = configOrg({ catalogos, configuracion }, org?.id)
  const dias = config.diasSinVisitaAlerta
  const lista = temas(base, dias).filter((t) => (typeof t.visible === 'function' ? t.visible(user) : puede(user, t.visible)))
  const contacto = config.contactoInstitucional

  return (
    <Page title="Ayuda" back>
      <div className="flex items-start gap-3 rounded-md border border-danger bg-danger-100 px-4 py-3 text-danger" role="note">
        <Siren size={22} className="mt-0.5 flex-none" aria-hidden />
        <p className="text-sm font-semibold leading-normal">
          ¿Es una emergencia? Llama al 9-1-1. CuidaRed no sustituye servicios médicos ni de emergencia.
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-md bg-blue-100 px-4 py-3.5 text-navy" aria-labelledby="ayuda-rol">
        <h2 id="ayuda-rol" className="flex items-center gap-2 text-lg font-bold">
          <UserRound size={20} aria-hidden /> Tu rol: {ROL_LABEL[user.rol]}
        </h2>
        <p className="text-pretty text-ink-2">{DESCRIPCION_ROL[user.rol]}</p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="ayuda-guia">
        <h2 id="ayuda-guia" className="section-title flex items-center gap-2">
          <ClipboardList size={22} aria-hidden className="text-blue" /> Guía rápida
        </h2>
        <p className="-mt-1 text-sm text-muted">Toca un tema para ver los pasos. En los formularios, el botón "?" junto a un campo explica qué escribir.</p>
        <div className="flex flex-col gap-2.5">
          {lista.map((t) => (
            <details key={t.id} id={`ayuda-${t.id}`} className="group overflow-hidden rounded-md border border-line-soft bg-surface shadow-1 open:border-blue">
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold text-ink hover:bg-blue-100 [&::-webkit-details-marker]:hidden">
                <span className="grid size-10 flex-none place-items-center rounded-md bg-blue-100 text-navy" aria-hidden>
                  {t.icono}
                </span>
                <span className="flex-1">{t.titulo}</span>
                <ChevronDown size={20} aria-hidden className="flex-none text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="flex flex-col gap-3 border-t border-line-soft px-4 pb-4 pt-3 leading-relaxed text-ink-2">{t.contenido}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1 rounded-md border border-line-soft bg-surface px-4 py-3.5" aria-labelledby="ayuda-mas">
        <h2 id="ayuda-mas" className="text-lg font-bold text-ink">
          ¿Necesitas más ayuda?
        </h2>
        <p className="text-pretty text-ink-2">
          Comunícate con el coordinador o el administrador de tu organización
          {contacto?.telefono ? (
            <>
              {' '}
              ({contacto.nombre}: <a href={`tel:${contacto.telefono.replace(/\D/g, '')}`} className="font-semibold text-navy underline">{contacto.telefono}</a>)
            </>
          ) : null}
          .
        </p>
        <Link to={`${base}/acerca`} className={ENLACE}>
          Acerca de CuidaRed
        </Link>
      </section>
    </Page>
  )
}
