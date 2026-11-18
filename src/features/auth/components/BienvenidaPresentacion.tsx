/*
 * BienvenidaPresentacion.tsx — Portada pública de CuidaRed para familias, organizaciones y visitantes.
 * Módulo: auth. © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, BookOpen, CalendarDays, ChevronDown, LifeBuoy,
  Mail, Menu, ScanSearch, X,
} from 'lucide-react'
import { PRODUCTO } from '@/lib/proyecto'
import { Circulos } from './Circulos'
import { PlanesPortada } from './PlanesPortada'

interface Props {
  solicitudVisita: ReactNode
  rutaConsulta?: string
}

const marco = 'mx-auto w-full max-w-[1240px] px-5 sm:px-8 lg:px-12'
const enlace = 'inline-flex min-h-12 items-center gap-2 font-semibold text-navy underline decoration-blue/40 decoration-1 underline-offset-4 hover:decoration-current'
const boton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-center text-sm font-semibold transition-colors motion-reduce:transition-none sm:px-5'
const primario = boton + ' bg-navy text-white hover:bg-navy-700'
const secundario = boton + ' border border-navy/30 bg-white text-navy hover:bg-blue-100'
const etiqueta = 'text-xs font-bold uppercase tracking-[0.16em] text-navy'
const titulo = 'text-balance font-serif text-[clamp(2rem,5vw,3.5rem)] font-normal leading-[1.06] tracking-tight text-navy'
const enlaceGuia = 'grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-4 text-navy hover:bg-blue-100/55 sm:gap-4 sm:px-5'
const enlacePie = 'inline-flex min-h-12 items-center text-blue-100 hover:text-white hover:underline underline-offset-4'
const navegacion = [
  { id: 'solicitar-visita', texto: 'Visitas' },
  { id: 'para-quien', texto: 'Familias y organizaciones' },
  { id: 'planes', texto: 'Planes' },
  { id: 'ayuda', texto: 'Ayuda' },
]
const ayuda = [
  ['¿Necesito una cuenta para solicitar una visita?',
    'Puedes enviar la solicitud como visitante. Elige la organización, indica a quién quieres visitar y guarda el código que recibirás. La organización revisará tu solicitud.'],
  ['¿Cómo sé si mi visita fue autorizada?',
    'Entra a «Consultar mi solicitud» con tu código de seguimiento. Allí podrás ver el estado y, si fue autorizada, la fecha y la hora confirmadas.'],
  ['¿Cuándo puedo enviar una observación?',
    'Después de la visita, vuelve a consultar tu código. El formulario de observaciones se habilita cuando el equipo registra la visita como realizada.'],
  ['¿Qué puedo hacer sin internet?',
    'Los equipos con acceso a la aplicación pueden guardar capturas de visitas en el dispositivo y sincronizarlas cuando vuelva la conexión. Para enviar o consultar una solicitud pública necesitas internet.'],
  ['¿Quién puede ver la información de cuidado?',
    'Cada persona ve lo que corresponde a su rol y a los permisos de su cuenta. La consulta pública de una solicitud muestra el estado y los datos de la cita, sin mostrar el expediente de la persona mayor.'],
] as const

const contacto = String(import.meta.env.VITE_CONTACTO_EMAIL ?? '').trim()
const correoValido = /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(contacto)

export function BienvenidaPresentacion({ solicitudVisita, rutaConsulta = '/solicitud-visita' }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const retornoPortada = '/' + location.hash
  const [menuAbierto, setMenuAbierto] = useState(false)
  const contenido = useRef<HTMLElement>(null)
  const botonMenu = useRef<HTMLButtonElement>(null)

  function desplazar(event: MouseEvent<HTMLAnchorElement>, id: string, cerrar?: () => void) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const destino = document.getElementById(id)
    if (!destino) return
    event.preventDefault()
    cerrar?.()
    navigate('#' + id, { replace: true })
    destino.focus({ preventScroll: true })
    destino.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    const ancla = window.location.hash.slice(1)
    if (ancla) document.getElementById(ancla)?.scrollIntoView()
  }, [])

  useEffect(() => {
    const movimiento = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (movimiento.matches || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entradas) => {
      for (const { target, isIntersecting } of entradas) {
        if (!isIntersecting) continue
        observer.unobserve(target)
        if (!movimiento.matches) target.animate([{ opacity: 0.72, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 380, easing: 'ease-out' })
      }
    }, { threshold: 0.22 })
    contenido.current?.querySelectorAll('[data-portada-foto]').forEach((foto) => observer.observe(foto))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-dvh bg-white text-ink">
      <a href="#contenido" onClick={(e) => desplazar(e, 'contenido')}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-sm focus:bg-navy focus:px-4 focus:py-3 focus:text-white">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-30 border-b border-line-soft bg-white pt-safe"
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !menuAbierto) return
          setMenuAbierto(false)
          botonMenu.current?.focus()
        }}>
        <div className={marco + ' flex min-h-[70px] items-center justify-between gap-2 sm:gap-4'}>
          <Link to="/" aria-label="CuidaRed, inicio" className="inline-flex min-h-12 shrink-0 items-center">
            <img src="/brand/logo.png" width={517} height={192} alt="" className="h-auto w-[110px] min-[380px]:w-[132px] sm:w-[144px]" />
          </Link>
          <nav aria-label="Menú principal" className="hidden min-w-0 items-center gap-5 lg:flex xl:gap-7">
            {navegacion.map(({ id, texto }) => <a key={id} href={'#' + id} onClick={(e) => desplazar(e, id)}
              className="inline-flex min-h-12 items-center whitespace-nowrap text-sm font-semibold text-ink-2 hover:text-navy hover:underline hover:underline-offset-4">{texto}</a>)}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link to="/inicio" state={{ retornoPortada }} className="inline-flex min-h-12 items-center rounded-sm px-1.5 text-sm font-semibold text-navy hover:bg-blue-100 sm:px-4">Iniciar sesión</Link>
            <div className="hidden lg:block"><Link to="/crear-cuenta" state={{ retornoPortada }} className={primario}>Crear cuenta</Link></div>
            <button ref={botonMenu} type="button" className="grid size-12 place-items-center rounded-sm border border-navy/25 text-navy hover:bg-blue-100 lg:hidden"
              aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto} aria-controls="menu-portada"
              onClick={() => setMenuAbierto(!menuAbierto)}>{menuAbierto ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}</button>
          </div>
        </div>
        <nav id="menu-portada" hidden={!menuAbierto} aria-label="Menú principal" className={marco + ' flex flex-col border-t border-line pb-3 lg:hidden'}>
          {navegacion.map(({ id, texto }) => <a key={id} href={'#' + id} onClick={(e) => desplazar(e, id, () => setMenuAbierto(false))}
            className="flex min-h-12 items-center border-b border-line-soft text-sm font-semibold text-navy">{texto}</a>)}
          <Link to="/crear-cuenta" state={{ retornoPortada }} onClick={() => setMenuAbierto(false)} className={primario + ' mt-3 self-start'}>Crear cuenta</Link>
        </nav>
      </header>

      <main ref={contenido} id="contenido" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <section className="relative isolate overflow-clip" aria-labelledby="titulo-bienvenida">
          <Circulos variante="portada" />
          <div className={marco + ' relative z-10 grid gap-8 pt-9 pb-11 sm:pt-14 sm:pb-16 md:grid-cols-[1fr_1.04fr] md:items-center md:gap-10 lg:gap-16 lg:pt-[4.5rem]'}>
            <div className="motion-safe:animate-fade">
              <p className={etiqueta + ' mb-3'}>Seguimiento comunitario</p>
              <h1 id="titulo-bienvenida" className="max-w-[13ch] text-balance font-serif text-[clamp(2.8rem,7vw,5.25rem)] font-normal leading-[0.98] tracking-[-0.045em] text-navy">
                El cuidado se organiza en comunidad.
              </h1>
              <p className="mt-5 max-w-[46ch] text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
                CuidaRed ayuda a familias y organizaciones a coordinar visitas, registrar necesidades y dar seguimiento al cuidado de las personas mayores.
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3">
                <a href="#solicitar-visita" onClick={(e) => desplazar(e, 'solicitar-visita')} className={primario}>
                  <CalendarDays size={18} aria-hidden /> Solicitar una visita
                </a>
                <Link to={rutaConsulta} className={secundario}><ScanSearch size={18} aria-hidden /> Consultar mi solicitud</Link>
              </div>
              <p className="mt-3 text-sm text-ink-2">Puedes solicitar y consultar una visita sin crear una cuenta.</p>
            </div>
            <figure className="min-w-0">
              <img src="/portada/visita-1200.webp" srcSet="/portada/visita-640.webp 640w, /portada/visita-1200.webp 1200w"
                sizes="(min-width:1240px) 540px, (min-width:768px) 46vw, 94vw" width={1200} height={990}
                fetchPriority="high" decoding="async" alt="Varias personas sonríen y conversan durante una visita"
                className="aspect-[1.25] w-full rounded-md object-cover object-center md:aspect-[1.06] lg:aspect-[1.16]" />
            </figure>
          </div>
        </section>

        <section id="solicitar-visita" tabIndex={-1} aria-labelledby="titulo-visitas"
          className="scroll-mt-24 border-y border-line-soft bg-blue-100/50 focus:outline-none">
          <div className={marco + ' grid gap-8 py-10 sm:py-14 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-16'}>
            <div>
              <p className={etiqueta + ' mb-3'}>Para visitantes</p>
              <h2 id="titulo-visitas" className={titulo}>Visitas a personas y organizaciones</h2>
              <ol className="mt-5 max-w-[42ch] divide-y divide-navy/15 text-sm text-ink-2 sm:text-base">
                <li className="flex gap-3 py-3"><span className="font-bold text-navy" aria-hidden>01</span><div><strong className="block text-navy">Envía tu solicitud</strong> Visita a una persona mayor o coordina una actividad con tu institución o grupo.</div></li>
                <li className="flex gap-3 py-3"><span className="font-bold text-navy" aria-hidden>02</span><div><strong className="block text-navy">Guarda tu código</strong> Úsalo para saber si la organización confirmó la visita.</div></li>
                <li className="flex gap-3 py-3"><span className="font-bold text-navy" aria-hidden>03</span><div><strong className="block text-navy">Comparte una observación</strong> Vuelve a consultar cuando el equipo registre la visita como realizada.</div></li>
              </ol>
              <Link to={rutaConsulta} className={enlace + ' mt-2'}>Consultar mi solicitud <ArrowRight size={17} aria-hidden /></Link>
            </div>
            <div className="min-w-0 rounded-md border border-navy/15 bg-white p-4 sm:p-6">{solicitudVisita}</div>
          </div>
        </section>

        <section id="para-quien" tabIndex={-1} aria-labelledby="titulo-para-quien" className={marco + ' scroll-mt-24 py-12 focus:outline-none sm:py-[4.5rem]'}>
          <h2 id="titulo-para-quien" className={titulo + ' mb-7 max-w-[18ch] sm:mb-9'}>Organiza el cuidado con quienes te acompañan</h2>
          <article className="grid items-center gap-6 border-t border-line py-7 md:grid-cols-[1.15fr_0.85fr] lg:gap-14">
            <img data-portada-foto src="/portada/familia.webp" width={840} height={640} loading="lazy" decoding="async"
              alt="Un hombre mayor y su familiar sonríen juntos en casa" className="aspect-[1.55] w-full rounded-md object-cover" />
            <div>
              <p className={etiqueta + ' mb-2'}>Familias</p>
              <h3 className="max-w-[21ch] text-balance text-2xl font-bold leading-tight text-navy sm:text-3xl">Coordina el cuidado en casa</h3>
              <p className="mt-3 max-w-[44ch] leading-relaxed text-ink-2">Organiza quién acompaña a tu familiar y comparte sus necesidades con las personas autorizadas.</p>
              <Link to="/registro-familia" state={{ retornoPortada }} className={enlace + ' mt-2'}>Crear cuenta familiar <ArrowRight size={17} aria-hidden /></Link>
            </div>
          </article>
          <article className="grid items-center gap-6 border-t border-line py-7 md:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <img data-portada-foto src="/portada/comunidad.webp" width={920} height={690} loading="lazy" decoding="async"
              alt="Un grupo de personas mayores conversa durante una actividad comunitaria" className="aspect-[1.55] w-full rounded-md object-cover md:order-2" />
            <div>
              <p className={etiqueta + ' mb-2'}>Organizaciones</p>
              <h3 className="max-w-[20ch] text-balance text-2xl font-bold leading-tight text-navy sm:text-3xl">Organiza a tu equipo de cuidado</h3>
              <p className="mt-3 max-w-[43ch] leading-relaxed text-ink-2">Coordina a cuidadores y voluntarios, programa visitas y consulta el seguimiento de las personas a tu cargo.</p>
              <Link to="/registro-organizacion" state={{ retornoPortada }} className={enlace + ' mt-2'}>Registrar mi organización <ArrowRight size={17} aria-hidden /></Link>
            </div>
          </article>
        </section>

        <section id="planes" tabIndex={-1} aria-labelledby="titulo-planes" className="scroll-mt-24 border-y border-line-soft bg-bg focus:outline-none">
          <div className={marco + ' py-11 sm:py-[4rem]'}>
            <header className="mb-7 grid items-end gap-3 sm:mb-8 lg:grid-cols-[1fr_0.65fr] lg:gap-10">
              <h2 id="titulo-planes" className={titulo}>Planes de CuidaRed</h2>
              <p className="max-w-[42ch] leading-relaxed text-ink-2">Compara la capacidad y las funciones de cada opción según el catálogo de referencia.</p>
            </header>
            <PlanesPortada />
          </div>
        </section>

        <section id="ayuda" tabIndex={-1} aria-labelledby="titulo-ayuda" className={marco + ' grid scroll-mt-24 gap-7 py-12 focus:outline-none sm:py-[4.5rem] lg:grid-cols-[0.78fr_1.22fr] lg:gap-16'}>
          <div>
            <p className={etiqueta + ' mb-3'}>Centro de ayuda</p>
            <h2 id="titulo-ayuda" className={titulo}>Preguntas frecuentes</h2>
            <a href="#documentacion" className={enlace + ' mt-2'} onClick={(e) => desplazar(e, 'documentacion')}>Ver guías de CuidaRed <ArrowDown size={16} aria-hidden /></a>
          </div>
          <div className="border-b border-line">
            {ayuda.map(([pregunta, respuesta]) => <details key={pregunta} className="group border-t border-line">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-navy [&::-webkit-details-marker]:hidden">{pregunta}
                <ChevronDown size={18} aria-hidden className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="max-w-[65ch] pb-4 text-sm leading-relaxed text-ink-2 sm:text-base">{respuesta}</p>
            </details>)}
          </div>
        </section>

        <section id="documentacion" tabIndex={-1} aria-labelledby="titulo-documentacion" className="scroll-mt-24 border-t border-line-soft bg-bg focus:outline-none">
          <div className={marco + ' py-11 sm:py-14'}>
            <h2 id="titulo-documentacion" className={titulo + ' mb-6 sm:mb-8'}>Guías y contacto</h2>
            <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8">
              <ul className="divide-y divide-line-soft rounded-md border border-line-soft bg-white">
                <li>
                  <Link to="/guias" className={enlaceGuia}>
                    <BookOpen size={21} className="mt-0.5" aria-hidden />
                    <span><strong className="block">Manual de usuario</strong><span className="mt-1 block text-sm leading-relaxed text-ink-2">Consulta cómo solicitar una visita, revisar la agenda y registrar sin conexión.</span></span>
                    <ArrowRight size={18} className="mt-1" aria-hidden />
                  </Link>
                </li>
                <li>
                  <Link to="/recuperar" className={enlaceGuia}>
                    <LifeBuoy size={21} className="mt-0.5" aria-hidden />
                    <span><strong className="block">Recuperar acceso</strong><span className="mt-1 block text-sm leading-relaxed text-ink-2">Restablece tu contraseña con el correo asociado a tu cuenta.</span></span>
                    <ArrowRight size={18} className="mt-1" aria-hidden />
                  </Link>
                </li>
              </ul>
              <aside id="contacto" tabIndex={-1} aria-labelledby="titulo-contacto" className="scroll-mt-24 rounded-md border border-line-soft bg-blue-100 px-5 py-4 focus:outline-none sm:px-6 sm:py-5">
                <h3 id="titulo-contacto" className="text-lg font-bold text-navy">Contáctanos</h3>
                <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-2">Para confirmar o cambiar una visita, comunícate con la organización que la gestiona. Consulta la fecha y el estado con tu código de seguimiento.</p>
                <div className="mt-1 flex flex-wrap gap-x-5">
                  <Link to={rutaConsulta} className={enlace + ' text-sm'}>Consultar mi solicitud <ArrowRight size={16} aria-hidden /></Link>
                  {correoValido && <a className={enlace + ' text-sm'} href={'mailto:' + contacto}><Mail size={16} aria-hidden /> Escribir a soporte</a>}
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-navy text-white">
        <div className={marco + ' grid grid-cols-2 gap-x-4 gap-y-6 pt-10 pb-6 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] lg:pt-12'}>
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" className="inline-flex min-h-12 items-center rounded-sm bg-white px-2 py-1" aria-label="CuidaRed, inicio">
              <img src="/brand/logo.png" width={517} height={192} alt="" loading="lazy" className="h-auto w-[138px]" />
            </Link>
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-blue-100">Proyecto académico del Instituto Tecnológico de Santo Domingo.</p>
          </div>
          <nav aria-label="Acciones del visitante" className="flex flex-col items-start text-sm">
            <p className="mb-1 font-bold">Visitas</p>
            <a href="#solicitar-visita" onClick={(e) => desplazar(e, 'solicitar-visita')} className={enlacePie}>Solicitar una visita</a>
            <Link to={rutaConsulta} className={enlacePie}>Consultar mi solicitud</Link>
          </nav>
          <nav aria-label="Cuenta de CuidaRed" className="flex flex-col items-start text-sm">
            <p className="mb-1 font-bold">Tu cuenta</p>
            <Link to="/inicio" state={{ retornoPortada }} className={enlacePie}>Iniciar sesión</Link>
            <Link to="/crear-cuenta" state={{ retornoPortada }} className={enlacePie}>Crear cuenta</Link>
            <a href="#planes" onClick={(e) => desplazar(e, 'planes')} className={enlacePie}>Comparar planes</a>
          </nav>
          <nav aria-label="Recursos de ayuda" className="flex flex-col items-start text-sm">
            <p className="mb-1 font-bold">Ayuda</p>
            <a href="#ayuda" onClick={(e) => desplazar(e, 'ayuda')} className={enlacePie}>Preguntas frecuentes</a>
            <a href="#documentacion" onClick={(e) => desplazar(e, 'documentacion')} className={enlacePie}>Documentación</a>
            <a href="#contacto" onClick={(e) => desplazar(e, 'contacto')} className={enlacePie}>Contáctanos</a>
          </nav>
        </div>
        <div className={marco + ' pb-[max(.75rem,env(safe-area-inset-bottom))]'}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 border-t border-white/25 pt-3 text-xs leading-relaxed text-blue-100">
            <p className="py-2">{PRODUCTO.copyright}</p>
            <nav aria-label="Información legal" className="flex flex-wrap gap-x-6 text-sm">
              <Link to="/privacidad" className={enlacePie}>Privacidad</Link>
              <Link to="/terminos" className={enlacePie}>Términos de uso</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
