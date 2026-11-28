/*
 * pantallas-ayuda.tsx — Pantallas de la ayuda flotante: Aprende a usar CuidaRed (y su guía), Preguntas frecuentes,
 * Cambiar idioma, Modo claro u oscuro, Accesibilidad y Contactar soporte (contenido fijo, ver datos-ayuda.ts).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Aviso, Button, Chip, FilaLista, Icono, SearchInput, TextField, TextareaField, type NombreIcono } from '@/components/ui'
import { cn } from '@/lib/cn'
import { guardarTamanoTexto, leerTamanoTexto, TAMANOS_TEXTO, type TamanoTexto } from './accesibilidad'
import {
  ARTICULOS_AYUDA, CATEGORIAS_AYUDA, CATEGORIAS_PREGUNTAS, IDIOMAS, MAS_CONSULTADOS, PREGUNTAS_FRECUENTES, TEMAS_SOPORTE, TEMAS_VISUALES,
  type ArticuloAyuda,
} from './datos-ayuda'
import { CORREO_SOPORTE, enlaceSoporte } from './soporte'

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const TARJETA = 'overflow-hidden rounded-md border border-surface-2 bg-surface shadow-1'
const SIN_RESULTADOS = 'rounded-md border border-surface-2 bg-surface p-5 text-center text-cuerpo text-ink-2'

/* ───────────── Aprende a usar CuidaRed ───────────── */

function FilaGuia({ articulo }: { articulo: ArticuloAyuda }) {
  return <Link to={`?guia=${articulo.id}`} className="flex min-h-16 items-center gap-3 px-3 py-3 hover:bg-blue-100/50 focus-visible:-outline-offset-2">
    <span aria-hidden className="grid size-10 flex-none place-items-center rounded-md bg-blue-100 text-navy"><Icono nombre="menu_book" /></span>
    <span className="grid min-w-0 flex-1">
      <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{articulo.titulo}</span>
      <span className="text-ayuda text-muted">Guía paso a paso</span>
    </span>
    <Icono nombre="chevron_right" className="flex-none text-muted" />
  </Link>
}

function Guia({ articulo }: { articulo: ArticuloAyuda }) {
  const { cuentaId } = useParams()
  const [util, setUtil] = useState<boolean>()
  const categoria = CATEGORIAS_AYUDA.find((item) => item.id === articulo.categoria)?.nombre
  useEffect(() => { window.scrollTo(0, 0) }, [articulo.id])
  return <article className="grid gap-4" aria-labelledby="titulo-guia">
    {categoria && <p className="text-ayuda text-muted">{categoria}</p>}
    <h2 id="titulo-guia" className="text-seccion text-ink wrap-anywhere">{articulo.titulo}</h2>
    <ol className={cn(TARJETA, 'grid gap-4 p-4')}>
      {articulo.pasos.map((paso, indice) => <li key={paso} className="flex items-start gap-3">
        <span aria-hidden className="grid size-8 flex-none place-items-center rounded-full bg-blue-100 text-ayuda font-bold text-blue-principal">{indice + 1}</span>
        <span className="min-w-0 pt-1 text-cuerpo text-ink wrap-anywhere">{paso}</span>
      </li>)}
    </ol>
    {articulo.consejo && <Aviso tipo="exito" icono="info">{articulo.consejo}</Aviso>}
    <section aria-labelledby="util-guia" className="grid gap-3">
      <h3 id="util-guia" className="text-cuerpo font-semibold text-ink">¿Te sirvió esta guía?</h3>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" aria-pressed={util === true} icon={<Icono nombre="thumb_up" tamano={20} />} onClick={() => setUtil(true)}>Sí</Button>
        <Button variant="outline" aria-pressed={util === false} icon={<Icono nombre="thumb_down" tamano={20} />} onClick={() => setUtil(false)}>No</Button>
      </div>
      {util === true && <p role="status" className="text-ayuda text-ink-2">Qué bueno que te ayudó.</p>}
      {util === false && <p role="status" className="text-ayuda text-ink-2">
        Lamentamos que no te sirviera. Puedes consultar las <Link className="font-semibold text-navy underline" to={`/operacion/${cuentaId}/preguntas`}>preguntas frecuentes</Link> o{' '}
        <Link className="font-semibold text-navy underline" to={`/operacion/${cuentaId}/soporte`}>escribir a soporte</Link>.
      </p>}
    </section>
  </article>
}

export function PantallaAprende() {
  const [parametros] = useSearchParams()
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const prefijo = useId()
  const consulta = normalizar(texto.trim())
  const guia = ARTICULOS_AYUDA.find((articulo) => articulo.id === parametros.get('guia'))
  const temas = CATEGORIAS_AYUDA.map((item) => ({ ...item, guias: ARTICULOS_AYUDA.filter((articulo) => articulo.categoria === item.id).length })).filter((item) => item.guias > 0)
  const filtrando = !!categoria || !!consulta
  const articulos = useMemo(() => filtrando
    ? ARTICULOS_AYUDA.filter((articulo) => (!categoria || articulo.categoria === categoria)
      && (!consulta || normalizar(`${articulo.titulo} ${articulo.pasos.join(' ')} ${articulo.consejo ?? ''}`).includes(consulta)))
    : MAS_CONSULTADOS.flatMap((id) => ARTICULOS_AYUDA.filter((articulo) => articulo.id === id)), [categoria, consulta, filtrando])
  if (guia) return <Guia articulo={guia} />
  const tituloLista = categoria ? temas.find((item) => item.id === categoria)?.nombre : consulta ? 'Resultados' : 'Lo más consultado'
  return <div className="grid gap-5">
    <SearchInput value={texto} onChange={(event) => setTexto(event.currentTarget.value)} placeholder="¿Qué quieres aprender?" aria-label="Buscar en la ayuda" />
    <section aria-labelledby={`${prefijo}-temas`} className="grid gap-3">
      <h2 id={`${prefijo}-temas`} className="text-seccion text-ink">Temas</h2>
      <div role="group" aria-label="Categorías de ayuda" className="grid grid-cols-2 gap-3">
        {temas.map((item) => <button key={item.id} type="button" aria-pressed={categoria === item.id} onClick={() => setCategoria(categoria === item.id ? '' : item.id)}
          className={cn('grid min-h-28 min-w-0 content-start justify-items-start gap-2 rounded-md border bg-surface p-4 text-start shadow-1', categoria === item.id ? 'border-navy ring-2 ring-navy/30' : 'border-surface-2 hover:border-blue')}>
          <span aria-hidden className="grid size-10 place-items-center rounded-md bg-blue-100 text-navy"><Icono nombre={item.icono} /></span>
          <span className="text-cuerpo font-semibold text-ink wrap-anywhere">{item.nombre}</span>
          <span className="text-ayuda text-muted">{item.guias} {item.guias === 1 ? 'guía' : 'guías'}</span>
        </button>)}
      </div>
    </section>
    <section aria-label="Artículos de ayuda" className="grid gap-3">
      <h2 className="text-seccion text-ink">{tituloLista}</h2>
      {articulos.length === 0
        ? <p role="status" className={SIN_RESULTADOS}>No hay artículos que coincidan con tu búsqueda.</p>
        : <ul className={cn(TARJETA, 'divide-y divide-surface-2')}>
          {articulos.map((articulo) => <li key={articulo.id}><FilaGuia articulo={articulo} /></li>)}
        </ul>}
    </section>
  </div>
}

/* ───────────── Preguntas frecuentes ───────────── */

export function PantallaPreguntas() {
  const { cuentaId } = useParams()
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [abierta, setAbierta] = useState<string>()
  const prefijo = useId()
  const consulta = normalizar(texto.trim())
  const preguntas = PREGUNTAS_FRECUENTES.filter((item) => (!categoria || item.categoria === categoria)
    && (!consulta || normalizar(`${item.pregunta} ${item.respuesta}`).includes(consulta)))
  return <div className="grid gap-4">
    <SearchInput value={texto} onChange={(event) => setTexto(event.currentTarget.value)} placeholder="Buscar una pregunta" aria-label="Buscar una pregunta" />
    <div role="group" aria-label="Categorías de preguntas" className="flex gap-2 overflow-x-auto pb-1">
      <Chip active={!categoria} onClick={() => setCategoria('')}>Todas</Chip>
      {CATEGORIAS_PREGUNTAS.map((item) => <Chip key={item.id} active={categoria === item.id} onClick={() => setCategoria(categoria === item.id ? '' : item.id)}>{item.nombre}</Chip>)}
    </div>
    {preguntas.length === 0
      ? <p role="status" className={SIN_RESULTADOS}>No hay preguntas que coincidan con tu búsqueda.</p>
      : <div className={cn(TARJETA, 'divide-y divide-surface-2')}>
        {preguntas.map((item) => {
          const abierto = abierta === item.id
          const id = `${prefijo}-${item.id}`
          return <div key={item.id} className={abierto ? 'bg-blue-100' : undefined}>
            <h2>
              <button type="button" id={`${id}-boton`} aria-expanded={abierto} aria-controls={`${id}-panel`} onClick={() => setAbierta(abierto ? undefined : item.id)}
                className={cn('flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-start text-cuerpo font-semibold hover:bg-blue-100/60 focus-visible:-outline-offset-2', abierto ? 'text-blue-principal' : 'text-ink')}>
                <span className="min-w-0 wrap-anywhere">{item.pregunta}</span>
                <Icono nombre={abierto ? 'keyboard_arrow_up' : 'keyboard_arrow_down'} className="flex-none text-muted" />
              </button>
            </h2>
            <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-boton`} hidden={!abierto} className="px-4 pb-4 text-cuerpo text-ink wrap-anywhere">{item.respuesta}</div>
          </div>
        })}
      </div>}
    <div className={cn(TARJETA, 'px-3')}>
      <FilaLista icono="support_agent" titulo="¿No encontraste tu respuesta?" descripcion="Escríbele al equipo de soporte." to={`/operacion/${cuentaId}/soporte`} />
    </div>
  </div>
}

/* ───────────── Idioma y tema: lista de opciones de solo lectura ───────────── */

type OpcionLista = { id: string; nombre: string; detalle: string; disponible: boolean; icono?: NombreIcono }

/** Lista con una opción seleccionada y las demás «Próximamente» (sin guardar nada: solo existe una opción real). */
function ListaOpciones({ etiqueta, opciones, seleccionada }: { etiqueta: string; opciones: OpcionLista[]; seleccionada: string }) {
  return <ul aria-label={etiqueta} className={cn(TARJETA, 'divide-y divide-surface-2')}>
    {opciones.map((opcion) => {
      const activa = opcion.id === seleccionada
      return <li key={opcion.id} aria-disabled={!opcion.disponible || undefined}
        className={cn('flex min-h-16 items-center gap-3 px-4 py-3', activa && 'bg-blue-100', !opcion.disponible && 'text-muted')}>
        {opcion.icono && <span aria-hidden className={cn('grid size-10 flex-none place-items-center rounded-md', activa ? 'bg-surface text-navy' : 'bg-surface-2 text-muted')}><Icono nombre={opcion.icono} /></span>}
        <span className="grid min-w-0 flex-1">
          <span className={cn('text-cuerpo font-semibold wrap-anywhere', activa ? 'text-blue-principal' : opcion.disponible ? 'text-ink' : 'text-muted')}>
            {opcion.nombre}
            {activa && <span className="sr-only"> (seleccionado)</span>}
          </span>
          <span className="text-ayuda text-muted wrap-anywhere">{opcion.detalle}</span>
        </span>
        {activa ? <Icono nombre="check_circle" className="flex-none text-blue-principal" />
          : opcion.disponible ? <Icono nombre="radio_button_unchecked" className="flex-none text-muted" />
            : <span className="flex-none rounded-pill bg-surface-2 px-3 py-1 text-etiqueta text-muted">Próximamente</span>}
      </li>
    })}
  </ul>
}

export function PantallaIdioma() {
  return <div className="grid gap-4">
    <p className="text-cuerpo text-ink-2">Elige el idioma en el que quieres ver CuidaRed. Los datos que registró tu equipo no se traducen. Por ahora solo está disponible el español.</p>
    <ListaOpciones etiqueta="Idiomas" opciones={IDIOMAS} seleccionada="es" />
  </div>
}

export function PantallaTema() {
  return <div className="grid gap-4">
    <p className="text-cuerpo text-ink-2">Elige cómo quieres ver CuidaRed. Por ahora solo está disponible el modo claro.</p>
    <ListaOpciones etiqueta="Modo de color" opciones={TEMAS_VISUALES} seleccionada="claro" />
  </div>
}

/* ───────────── Accesibilidad ───────────── */

/** Opción de un grupo de radios nativos (teclado, flechas y lectores de pantalla gratis) con aspecto de tarjeta. */
function OpcionRadio({ grupo, valor, marcada, alElegir, children, className }: {
  grupo: string
  valor: string
  marcada: boolean
  alElegir: () => void
  children: ReactNode
  className?: string
}) {
  return <label className={cn('relative flex min-h-14 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-principal',
    marcada ? 'border-2 border-blue-principal bg-blue-100 px-[15px] py-[11px]' : 'border-surface-2 bg-surface hover:bg-blue-100/50', className)}>
    <input type="radio" name={grupo} value={valor} checked={marcada} onChange={alElegir} className="sr-only" />
    {children}
    <Icono nombre={marcada ? 'check_circle' : 'radio_button_unchecked'} className={cn('ms-auto flex-none', marcada ? 'text-blue-principal' : 'text-muted')} />
  </label>
}

export function PantallaAccesibilidad() {
  const [tamano, setTamano] = useState<TamanoTexto>(leerTamanoTexto)
  const elegir = (nuevo: TamanoTexto) => {
    setTamano(nuevo)
    guardarTamanoTexto(nuevo)
  }
  return <div className="grid gap-4">
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-seccion text-ink">Tamaño del texto</legend>
      <p className="text-cuerpo text-ink-2">Elige un tamaño más cómodo para leer. Se aplica a toda la aplicación y se recuerda en este dispositivo.</p>
      {TAMANOS_TEXTO.map((opcion) => <OpcionRadio key={opcion.id} grupo="tamano-texto" valor={opcion.id} marcada={tamano === opcion.id} alElegir={() => elegir(opcion.id)}>
        <span className="grid min-w-0">
          <span className="text-cuerpo font-semibold text-ink">{opcion.nombre}</span>
          <span className="text-ayuda text-muted">{String(opcion.porcentaje).replace('.', ',')} %</span>
        </span>
      </OpcionRadio>)}
    </fieldset>
    <p className="rounded-md border border-surface-2 bg-surface p-4 text-cuerpo text-ink-2" aria-live="polite">
      Así se verá el texto: visitas, necesidades y alertas de las personas que acompañas.
    </p>
  </div>
}

/* ───────────── Contactar soporte ───────────── */

export function PantallaSoporte({ cuenta, volver, abrir = (url) => { window.location.href = url } }: { cuenta: string; volver: () => void; abrir?: (url: string) => void }) {
  const [enviado, setEnviado] = useState(false)
  const [tema, setTema] = useState(TEMAS_SOPORTE[0]!.id)
  const correo = CORREO_SOPORTE
  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!correo) return
    const datos = new FormData(event.currentTarget)
    const asunto = String(datos.get('asunto') ?? '').trim()
    const mensaje = String(datos.get('mensaje') ?? '').trim()
    if (!asunto || !mensaje) return
    // No hay endpoint de soporte: el mensaje sale por la app de correo del dispositivo.
    abrir(enlaceSoporte({ correo, tema: TEMAS_SOPORTE.find((item) => item.id === tema)?.nombre ?? '', asunto, mensaje, cuenta }))
    setEnviado(true)
  }
  if (enviado) {
    return <div role="status" className="grid justify-items-center gap-4 pt-6 text-center">
      <span aria-hidden className="grid size-24 place-items-center rounded-full bg-teal-100 text-teal"><Icono nombre="mark_email_read" tamano={48} /></span>
      <h2 className="text-seccion text-ink">Tu mensaje está listo</h2>
      <p className="text-cuerpo text-ink-2">Abrimos tu aplicación de correo con el mensaje listo para enviar a {correo}. Si no se abrió, escríbenos a esa dirección. Si es urgente y alguien está en peligro, llama al 9-1-1.</p>
      <Button onClick={volver}>Finalizar</Button>
    </div>
  }
  return <form onSubmit={enviar} className="grid gap-5">
    <p className="text-cuerpo text-ink-2">Cuéntanos qué pasó. Se abrirá tu aplicación de correo con el mensaje listo para enviarlo al equipo de CuidaRed.</p>
    {!correo && <Aviso tipo="advertencia" icono="mail">
      El correo de soporte todavía no está configurado en esta versión de CuidaRed, así que no podemos enviar ni abrir un mensaje. Consulta a la persona responsable de tu organización.
    </Aviso>}
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-cuerpo font-semibold text-ink">¿Sobre qué es?<span aria-hidden> *</span><span className="sr-only"> (obligatorio)</span></legend>
      <div className="grid grid-cols-2 gap-3">
        {TEMAS_SOPORTE.map((item) => <OpcionRadio key={item.id} grupo="tema-soporte" valor={item.id} marcada={tema === item.id} alElegir={() => setTema(item.id)} className="[&>svg:last-child]:hidden">
          <Icono nombre={item.icono} className={tema === item.id ? 'flex-none text-blue-principal' : 'flex-none text-muted'} />
          <span className="min-w-0 text-cuerpo font-semibold text-ink wrap-anywhere">{item.nombre}</span>
        </OpcionRadio>)}
      </div>
    </fieldset>
    <TextField label="Asunto" name="asunto" required maxLength={120} placeholder="Ej.: No puedo subir una foto de evidencia" />
    <TextareaField label="Mensaje" name="mensaje" required maxLength={2000} placeholder="Describe qué estabas haciendo y qué pasó" />
    <div className="grid gap-3">
      <Button type="submit" disabled={!correo} icon={<Icono nombre="send" tamano={20} />}>Enviar mensaje</Button>
      <Button variant="outline" onClick={volver}>Cancelar</Button>
    </div>
  </form>
}
