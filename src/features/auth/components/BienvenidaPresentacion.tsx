/*
 * BienvenidaPresentacion.tsx — Página de bienvenida pública de CuidaRed ("/"): qué es, para quién, cómo funciona,
 * acciones principales (Iniciar sesión, Crear cuenta, Solicitar una visita, Consultar mi solicitud), aviso de
 * emergencias y enlaces legales.
 * Módulo: auth (feedback de PM · CREACIÓN DEL HOME PAGE / BIENVENIDA · SRS §18.1 identidad visual, §18.3, §18.6).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Solo presentación: no usa el store (useDB), por lo que el mismo componente sirve en el prototipo y en el modo
 * conectado. La parte de "Solicitar una visita" entra por `solicitudVisita` (ver SolicitarVisita.tsx): en el
 * prototipo la página Bienvenida le pasa el formulario conectado a domain/api/solicitudes; en el modo conectado,
 * donde la solicitud aún no tiene API, se le pasa <SolicitarVisita disponible={false} … />.
 * Requiere un <Router> (usa Link) y las rutas /inicio, /crear-cuenta, /registro-familia, /registro-organizacion,
 * /terminos y /privacidad.
 */
import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Building2, CalendarCheck, ClipboardList, Gift, HeartHandshake, House, LogIn, ScanSearch, ShieldCheck, Siren, UserPlus, WifiOff } from 'lucide-react'
import { ButtonLink } from '@/components/ui'
import { DIAS_PRUEBA_GRATUITA } from '@/domain/planes'
import { PRODUCTO } from '@/lib/proyecto'

interface Props {
  /** Formulario "Solicitar una visita" (componente SolicitarVisita ya configurado). */
  solicitudVisita: ReactNode
  /** Ruta de "Consultar mi solicitud". */
  rutaConsulta?: string
}

const ID_SOLICITUD = 'solicitar-visita'

const ENLACE_PIE = 'inline-flex min-h-12 items-center px-2 text-sm text-ink-2 underline underline-offset-[3px] hover:text-navy'
/** Mismo aspecto que ButtonLink variant="light", pero para un ancla dentro de la página. */
const ANCLA_BOTON =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border-2 border-blue bg-blue-100 px-4 text-center text-base font-semibold leading-[1.1] text-navy transition hover:bg-blue-100/60 active:translate-y-px'

/** Desplaza hasta el formulario de solicitud y le pasa el foco (respeta "reducir movimiento"). */
function irASolicitud(e: MouseEvent<HTMLAnchorElement>) {
  const destino = document.getElementById(ID_SOLICITUD)
  if (!destino) return
  e.preventDefault()
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  destino.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' })
  destino.focus({ preventScroll: true })
}

const QUE_ES: Array<{ icono: ReactNode; titulo: string; texto: string }> = [
  { icono: <HeartHandshake size={26} />, titulo: 'Visitas y necesidades al día', texto: 'Cada visita deja registro de cómo está la persona y qué necesita.' },
  { icono: <BellRing size={26} />, titulo: 'Alertas para actuar a tiempo', texto: 'Avisa cuando alguien lleva días sin visita o es un caso prioritario.' },
  { icono: <WifiOff size={26} />, titulo: 'También sin internet', texto: 'Las visitas se guardan en el teléfono y se sincronizan al volver la red.' },
  { icono: <ShieldCheck size={26} />, titulo: 'Privacidad por rol', texto: 'Cada persona ve solo lo que le corresponde según su rol y su permiso.' },
]

const PASOS: Array<{ titulo: string; texto: string }> = [
  { titulo: 'Crea tu cuenta', texto: `Elige Familia u Organización. Son ${DIAS_PRUEBA_GRATUITA} días gratis, sin tarjeta.` },
  { titulo: 'Registra a las personas mayores y a tu equipo', texto: 'Agrega sus perfiles e invita a cuidadores, voluntarios y familiares, cada uno con los permisos de su rol.' },
  { titulo: 'Visita y registra', texto: 'Después de cada visita se anota cómo encontraron a la persona y qué necesita, incluso sin conexión.' },
  { titulo: 'Recibe alertas y da seguimiento', texto: 'CuidaRed avisa los casos que necesitan atención y todos ven el mismo seguimiento.' },
]

const PARA_QUIEN: Array<{ icono: ReactNode; etiqueta: string; titulo: string; puntos: string[]; to: string; accion: string }> = [
  {
    icono: <House size={28} />,
    etiqueta: 'Familias',
    titulo: 'Si cuidas a un familiar mayor',
    puntos: ['Coordina a cuidadores y familiares en un solo lugar.', 'Registra visitas, necesidades e indicaciones médicas.', 'Decide quién tiene acceso a cada perfil.'],
    to: '/registro-familia',
    accion: 'Crear cuenta familiar',
  },
  {
    icono: <Building2 size={28} />,
    etiqueta: 'Organizaciones',
    titulo: 'Iglesias, fundaciones, asilos y universidades',
    puntos: ['Gestiona voluntarios, visitas y casos prioritarios.', 'Consulta alertas de riesgo y reportes del equipo.', 'Recibe solicitudes de visita de personas de la comunidad.'],
    to: '/registro-organizacion',
    accion: 'Registrar mi organización',
  },
]

export function BienvenidaPresentacion({ solicitudVisita, rutaConsulta = '/solicitud-visita' }: Props) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-md focus:bg-navy focus:px-4 focus:py-3 focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <main id="contenido">
        {/* ───────── Presentación ───────── */}
        <section className="relative isolate overflow-clip bg-[linear-gradient(180deg,#e6f1fb_0%,#f7f9fc_100%)]" aria-labelledby="titulo-bienvenida">
          <div className="pointer-events-none absolute -left-24 -top-24 -z-10 size-72 rounded-full bg-blue/25 md:size-96" aria-hidden />
          <div className="pointer-events-none absolute -right-20 bottom-0 -z-10 size-56 rounded-full bg-teal-100 md:size-80" aria-hidden />
          <div className="pointer-events-none absolute right-[18%] top-10 -z-10 size-8 rounded-full bg-[#003f9e]/80" aria-hidden />

          <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 pb-12 pt-[max(24px,var(--safe-top))] md:px-8 md:pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14 lg:pb-20">
            <div className="flex flex-col gap-6">
              <img src="/brand/logo.png" width={279} height={104} alt="CuidaRed · Seguimiento Comunitario" className="block h-auto w-[min(240px,70%)] md:w-[279px]" />
              <div className="flex flex-col gap-4">
                <h1 id="titulo-bienvenida" className="text-balance text-[clamp(30px,7.5vw,48px)] font-bold leading-[1.1] text-navy">
                  Acompañar a nuestros adultos mayores, entre todos
                </h1>
                <p className="max-w-[56ch] text-pretty text-lg leading-relaxed text-ink-2">
                  CuidaRed conecta a familias, voluntarios y organizaciones para dar seguimiento al cuidado de las personas mayores de tu comunidad: visitas, necesidades y
                  alertas en un solo lugar.
                </p>
              </div>

              <div className="flex max-w-[520px] flex-col gap-3">
                <ButtonLink to="/inicio" fullWidth icon={<LogIn size={22} aria-hidden />}>
                  Iniciar sesión
                </ButtonLink>
                <div className="flex flex-col gap-1.5">
                  <ButtonLink to="/crear-cuenta" variant="outline" fullWidth icon={<UserPlus size={22} aria-hidden />}>
                    Crear cuenta
                  </ButtonLink>
                  <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-navy">
                    <Gift size={16} aria-hidden className="flex-none" />
                    Familia u Organización · {DIAS_PRUEBA_GRATUITA} días gratis, sin tarjeta
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <a href={`#${ID_SOLICITUD}`} onClick={irASolicitud} className={ANCLA_BOTON}>
                    <CalendarCheck size={20} aria-hidden />
                    <span>Solicitar una visita</span>
                  </a>
                  <ButtonLink to={rutaConsulta} variant="light" size="sm" fullWidth icon={<ScanSearch size={20} aria-hidden />}>
                    Consultar mi solicitud
                  </ButtonLink>
                </div>
              </div>
            </div>

            <aside className="hidden flex-col items-center gap-5 rounded-[28px] bg-white/90 p-10 text-center shadow-[0_12px_40px_-16px_rgba(12,59,110,0.25)] lg:flex" aria-label="Qué ofrece CuidaRed">
              <img src="/brand/logosimbolo.png" width={149} height={178} alt="" className="h-auto w-36" />
              <p className="text-balance text-xl font-semibold leading-snug text-navy">Una red que conecta a quienes cuidan con quienes necesitan compañía.</p>
              <ul className="flex flex-col gap-3 text-left text-ink-2">
                <li className="flex items-center gap-3">
                  <HeartHandshake size={22} className="flex-none text-teal" aria-hidden /> Visitas de seguimiento y necesidades al día
                </li>
                <li className="flex items-center gap-3">
                  <BellRing size={22} className="flex-none text-teal" aria-hidden /> Alertas de riesgo para actuar a tiempo
                </li>
                <li className="flex items-center gap-3">
                  <ClipboardList size={22} className="flex-none text-teal" aria-hidden /> Familias y voluntarios siempre conectados
                </li>
              </ul>
            </aside>
          </div>
        </section>

        {/* ───────── Qué es ───────── */}
        <section className="mx-auto w-full max-w-[1180px] px-5 py-12 md:px-8 md:py-16" aria-labelledby="titulo-que-es">
          <div className="mb-8 flex max-w-[62ch] flex-col gap-3">
            <h2 id="titulo-que-es" className="text-balance text-3xl font-bold leading-tight text-navy">
              ¿Qué es CuidaRed?
            </h2>
            <p className="text-pretty text-lg leading-relaxed text-ink-2">
              Es una aplicación de seguimiento comunitario para el cuidado de adultos mayores. Funciona como una red: cuidadores, voluntarios, familiares y coordinadores
              comparten la misma información, cada quien con lo que necesita ver.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUE_ES.map((q) => (
              <li key={q.titulo} className="flex items-start gap-4 rounded-md border border-line-soft bg-surface p-5 shadow-1 sm:flex-col sm:gap-3">
                <span className="grid size-12 flex-none place-items-center rounded-md bg-blue-100 text-navy" aria-hidden>
                  {q.icono}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <h3 className="text-lg font-bold leading-snug text-navy">{q.titulo}</h3>
                  <p className="text-ink-2">{q.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ───────── Para quién ───────── */}
        <section className="bg-blue-100/60" aria-labelledby="titulo-para-quien">
          <div className="mx-auto w-full max-w-[1180px] px-5 py-12 md:px-8 md:py-16">
            <h2 id="titulo-para-quien" className="mb-8 text-balance text-3xl font-bold leading-tight text-navy">
              ¿Para quién es?
            </h2>
            <ul className="grid gap-5 md:grid-cols-2">
              {PARA_QUIEN.map((p) => (
                <li key={p.etiqueta} className="flex flex-col gap-4 rounded-lg border border-line-soft bg-surface p-6 shadow-1">
                  <div className="flex items-center gap-4">
                    <span className="grid size-14 flex-none place-items-center rounded-md bg-teal-100 text-success-700" aria-hidden>
                      {p.icono}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{p.etiqueta}</p>
                      <h3 className="text-xl font-bold leading-snug text-navy">{p.titulo}</h3>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-2 text-ink-2">
                    {p.puntos.map((t) => (
                      <li key={t} className="flex gap-2.5">
                        <span aria-hidden className="mt-2 size-2 flex-none rounded-full bg-teal" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                  <ButtonLink to={p.to} variant="outline" fullWidth className="mt-auto">
                    {p.accion}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ───────── Cómo funciona ───────── */}
        <section className="mx-auto w-full max-w-[1180px] px-5 py-12 md:px-8 md:py-16" aria-labelledby="titulo-como-funciona">
          <h2 id="titulo-como-funciona" className="mb-8 text-balance text-3xl font-bold leading-tight text-navy">
            Cómo funciona
          </h2>
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="flex gap-4 sm:flex-col">
                <span className="grid size-12 flex-none place-items-center rounded-full bg-navy text-xl font-bold text-white" aria-hidden>
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold leading-snug text-navy">
                    <span className="sr-only">Paso {i + 1}: </span>
                    {p.titulo}
                  </h3>
                  <p className="text-ink-2">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ───────── Visitantes ───────── */}
        <section className="bg-teal-100/50" aria-labelledby="titulo-visitantes">
          <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
            <div className="flex flex-col gap-4">
              <h2 id="titulo-visitantes" className="text-balance text-3xl font-bold leading-tight text-navy">
                ¿Quieres visitar a un adulto mayor?
              </h2>
              <p className="text-pretty text-lg leading-relaxed text-ink-2">
                Cualquier persona puede ofrecer su compañía. No necesitas crear una cuenta: pides la visita a una organización y una persona responsable decide si la autoriza.
              </p>
              <ol className="flex flex-col gap-3 text-ink-2">
                <li className="flex gap-3">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden>
                    1
                  </span>
                  <span>Llena la solicitud y recibe tu código de seguimiento.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden>
                    2
                  </span>
                  <span>La organización autoriza o no tu visita.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-navy text-sm font-bold text-white" aria-hidden>
                    3
                  </span>
                  <span>Con tu código consultas el resultado y, después de visitar, dejas tu observación.</span>
                </li>
              </ol>
              <p className="flex gap-2.5 rounded-sm border border-line-soft bg-surface px-3.5 py-3 text-sm leading-snug text-ink-2">
                <ShieldCheck size={18} aria-hidden className="mt-px flex-none text-blue" />
                Por privacidad nunca mostramos perfiles ni datos de las personas mayores.
              </p>
              <ButtonLink to={rutaConsulta} variant="outline" size="sm" icon={<ScanSearch size={20} aria-hidden />} className="self-start">
                Consultar mi solicitud
              </ButtonLink>
            </div>

            <section id={ID_SOLICITUD} tabIndex={-1} aria-label="Solicitar una visita" className="scroll-mt-4 rounded-lg border border-line-soft bg-surface p-5 shadow-2 outline-none md:p-8">
              {solicitudVisita}
            </section>
          </div>
        </section>
      </main>

      {/* ───────── Pie ───────── */}
      <footer className="border-t border-line-soft bg-surface">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-8 md:px-8">
          <p className="flex max-w-[78ch] items-start gap-2.5 rounded-sm bg-blue-100 px-3.5 py-3 text-sm leading-snug text-navy">
            <Siren size={18} aria-hidden className="mt-px flex-none" />
            <span>
              <strong>CuidaRed no sustituye servicios médicos ni de emergencia.</strong> Es una herramienta de coordinación y seguimiento comunitario. En una emergencia
              llama al 9-1-1.
            </span>
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Avisos legales" className="-ml-2 flex flex-wrap items-center">
              <Link to="/terminos" className={ENLACE_PIE}>
                Términos y condiciones
              </Link>
              <span aria-hidden className="text-muted">
                ·
              </span>
              <Link to="/privacidad" className={ENLACE_PIE}>
                Política de privacidad
              </Link>
            </nav>
            <p className="text-xs leading-relaxed text-muted md:text-right">
              {PRODUCTO.copyright}
              <br />
              Proyecto académico del INTEC · Versión {PRODUCTO.version}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default BienvenidaPresentacion
