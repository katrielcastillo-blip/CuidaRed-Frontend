/*
 * Legal.tsx — "/terminos" y "/privacidad": Términos y Condiciones y Política de Privacidad con índice de anclas.
 * Módulo: auth (SRS §8.2.2.3.1–8.2.2.3.5 · §15 · §17.3 · §18.3 "enlaces a los avisos legales" · §18.6).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Fragment, useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ChevronDown, Info, ListOrdered, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { PRODUCTO } from '@/lib/proyecto'
import { AuthScreen } from '../components/AuthScreen'
import { POLITICA, TERMINOS, type Bloque, type Documento } from '../lib/legal'

/** Texto con **negrita**. */
function Rico({ texto }: { texto: string }) {
  const partes = texto.split('**')
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-ink">
            {p}
          </strong>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}

function BloqueLegal({ b }: { b: Bloque }) {
  if (typeof b === 'string') {
    return (
      <p className="text-pretty">
        <Rico texto={b} />
      </p>
    )
  }
  if ('lista' in b) {
    const Lista = b.ordenada ? 'ol' : 'ul'
    return (
      <Lista className={cn('flex flex-col gap-2 pl-6', b.ordenada ? 'list-decimal marker:font-bold marker:text-navy' : 'list-disc marker:text-blue')}>
        {b.lista.map((t) => (
          <li key={t} className="pl-1 text-pretty">
            <Rico texto={t} />
          </li>
        ))}
      </Lista>
    )
  }
  if ('sub' in b) {
    const textos = Array.isArray(b.texto) ? b.texto : [b.texto]
    return (
      <div className="flex flex-col gap-1 border-l-[3px] border-blue-100 pl-3.5">
        <h3 className="text-base font-semibold text-navy">{b.sub}</h3>
        {textos.map((t) => (
          <p key={t} className="text-pretty">
            <Rico texto={t} />
          </p>
        ))}
      </div>
    )
  }
  if ('aviso' in b) {
    const warning = b.tono === 'warning'
    return (
      <div className={cn('flex items-start gap-3 rounded-md border px-4 py-3', warning ? 'border-warning bg-warning-100 text-[#5c3a00]' : 'border-blue bg-blue-100 text-navy')}>
        {warning ? <TriangleAlert size={20} className="mt-0.5 flex-none" aria-hidden /> : <Info size={20} className="mt-0.5 flex-none" aria-hidden />}
        <p className="text-pretty">
          <Rico texto={b.aviso} />
        </p>
      </div>
    )
  }
  const { cabecera, filas } = b.tabla
  return (
    <div className="overflow-hidden rounded-md border border-line-soft">
      <table className="w-full border-collapse text-left text-[0.95em]">
        <thead className="hidden bg-blue-100 text-navy md:table-header-group">
          <tr>
            <th scope="col" className="w-[30%] px-4 py-2.5 font-semibold">
              {cabecera[0]}
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              {cabecera[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([a, c]) => (
            <tr key={a} className="flex flex-col border-t border-line-soft first:border-t-0 md:table-row md:first:border-t">
              <th scope="row" className="bg-surface px-4 pt-3 font-semibold text-navy md:bg-transparent md:py-3 md:align-top">
                {a}
              </th>
              <td className="bg-surface px-4 pb-3 pt-1 md:bg-transparent md:py-3">
                <Rico texto={c} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Salta a una sección sin añadir entradas al historial (la flecha "Volver" sigue funcionando). */
function saltar(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const destino = document.getElementById(id)
  if (!destino) return
  e.preventDefault()
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  destino.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' })
  destino.focus({ preventScroll: true })
}

const ancho = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 768px)').matches

function DocumentoLegal({ doc, otro }: { doc: Documento; otro: { to: string; texto: string } }) {
  const [indiceAbierto, setIndiceAbierto] = useState(ancho)

  return (
    <AuthScreen title={doc.titulo} back gradient="registro" wide>
      <article id="inicio-documento" tabIndex={-1} className="outline-nonemx-auto flex w-full max-w-[70ch] flex-col gap-6 text-base leading-relaxed text-ink md:gap-8 md:text-[1.0625rem]">
        <p className="text-pretty text-ink-2">
          <Rico texto={doc.resumen} />
        </p>

        <details
          className="group rounded-md border border-line-soft bg-surface shadow-1"
          open={indiceAbierto}
          onToggle={(e) => setIndiceAbierto((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold text-navy [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ListOrdered size={20} aria-hidden /> Contenido
            </span>
            <ChevronDown size={20} aria-hidden className="transition-transform group-open:rotate-180" />
          </summary>
          <nav aria-label={`Índice de ${doc.titulo}`} className="border-t border-line-soft px-2 py-2">
            <ol className="grid md:grid-cols-2 md:gap-x-4">
              {doc.secciones.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={(e) => saltar(e, s.id)} className="flex min-h-12 items-center rounded-sm px-2 text-[0.95rem] leading-snug text-ink-2 hover:bg-blue-100 hover:text-navy">
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </details>

        <hr className="h-0.5 w-full border-0 bg-blue/70" />

        {doc.secciones.map((s) => (
          <section key={s.id} id={s.id} tabIndex={-1} aria-labelledby={`${s.id}-t`} className="flex scroll-mt-4 flex-col gap-3 outline-none">
            <h2 id={`${s.id}-t`} className="text-lg font-bold leading-snug text-navy md:text-xl">
              {s.titulo}
            </h2>
            {s.bloques.map((b, i) => (
              <BloqueLegal key={i} b={b} />
            ))}
          </section>
        ))}

        <Pie otro={otro} actualizado={doc.actualizado} />
      </article>
    </AuthScreen>
  )
}

function Pie({ otro, actualizado }: { otro: { to: string; texto: string }; actualizado: ReactNode }) {
  return (
    <footer className="flex flex-col items-center gap-2 border-t border-line-soft pt-5 text-center">
      <div className="flex flex-wrap justify-center gap-x-4">
        <a href="#inicio-documento" onClick={(e) => saltar(e, 'inicio-documento')} className="inline-flex min-h-12 items-center gap-1.5 font-semibold text-navy underline underline-offset-[3px]">
          <ArrowUp size={18} aria-hidden /> Volver al inicio
        </a>
        <Link to={otro.to} className="inline-flex min-h-12 items-center font-semibold text-navy underline underline-offset-[3px]">
          {otro.texto}
        </Link>
      </div>
      <p className="text-xs text-muted">{actualizado}</p>
      <p className="text-xs text-muted">
        {PRODUCTO.copyright} Proyecto académico del {PRODUCTO.institucion}.
      </p>
    </footer>
  )
}

export function Terminos() {
  return <DocumentoLegal doc={TERMINOS} otro={{ to: '/privacidad', texto: 'Leer la Política de Privacidad' }} />
}

export function Privacidad() {
  return <DocumentoLegal doc={POLITICA} otro={{ to: '/terminos', texto: 'Leer los Términos y Condiciones' }} />
}
