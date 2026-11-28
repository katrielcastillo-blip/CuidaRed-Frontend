/*
 * ayuda.tsx — Botón flotante de ayuda y su menú (seis opciones: Aprende, Preguntas frecuentes, Idioma, Soporte, Modo claro u oscuro y Accesibilidad).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icono } from '@/components/ui'
import { OPCIONES_AYUDA } from './datos-ayuda'
import { useCapa } from './use-capa'

const SOBRE_BARRA = 'fixed right-4 bottom-[calc(var(--bottomnav-h)+16px+var(--safe-bottom))] z-40 md:right-6 md:bottom-6'
const SIN_BARRA = 'fixed right-4 bottom-[calc(16px+var(--safe-bottom))] z-40 md:right-6 md:bottom-6'
const BOTON = 'grid size-14 place-items-center rounded-full shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function AyudaFlotante({ raiz, sinBarraInferior }: { raiz: string; sinBarraInferior?: boolean }) {
  const [abierta, setAbierta] = useState(false)
  const disparador = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titulo = useId()
  const cerrar = (devolverFoco: boolean) => {
    setAbierta(false)
    if (devolverFoco) requestAnimationFrame(() => disparador.current?.focus())
  }
  useCapa(abierta, () => cerrar(true), panel)
  return <>
    <button ref={disparador} type="button" aria-label="Ayuda" aria-haspopup="dialog" aria-expanded={abierta}
      onClick={() => setAbierta(true)} className={`${sinBarraInferior ? SIN_BARRA : SOBRE_BARRA} ${BOTON} bg-navy text-white ring-2 ring-white hover:bg-blue-principal`}>
      {/* Figma «Ayuda flotante · Cerrado»: logosímbolo en negativo (blanco) sobre el círculo azul noche. */}
      <img src="/brand/logosimbolo.png" alt="" width={172} height={205} className="h-9 w-auto brightness-0 invert" />
    </button>
    {abierta && <div className="fixed inset-0 z-50 bg-navy/50 animate-fade" onMouseDown={(event) => event.target === event.currentTarget && cerrar(true)}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titulo}
        className="absolute right-4 bottom-[calc(16px+var(--safe-bottom))] flex max-h-[calc(100dvh-32px-var(--safe-bottom))] max-w-[calc(100%-32px)] flex-col items-end gap-3 outline-none animate-up md:right-6 md:bottom-6">
        <h2 id={titulo} className="sr-only">Ayuda</h2>
        <ul className="grid min-h-0 justify-items-end gap-3 overflow-y-auto overscroll-contain py-1 pe-1">
          {OPCIONES_AYUDA.map((opcion) => <li key={opcion.id}>
            <Link to={`${raiz}/${opcion.id}`} onClick={() => cerrar(false)}
              className="flex min-h-12 items-center gap-3 rounded-pill bg-surface py-1.5 ps-5 pe-2 text-cuerpo font-semibold text-navy shadow-2 hover:bg-blue-100">
              <span>{opcion.nombre}</span>
              <span className="grid size-10 flex-none place-items-center rounded-full bg-blue-100 text-navy"><Icono nombre={opcion.icono} /></span>
            </Link>
          </li>)}
        </ul>
        <button type="button" onClick={() => cerrar(true)} aria-label="Cerrar ayuda" className={`${BOTON} bg-surface text-navy hover:bg-blue-100`}>
          <Icono nombre="close" tamano={28} />
        </button>
      </div>
    </div>}
  </>
}
