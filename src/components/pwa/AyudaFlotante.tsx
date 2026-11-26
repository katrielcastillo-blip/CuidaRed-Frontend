/* Menú visual de ayuda; únicamente abrir y cerrar está habilitado en esta entrega. © 2026 Equipo CuidaRed – INTEC. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/icons'
import { useLogo } from '@/lib/marca'

const opciones = [
  { nombre: 'Aprende a usar CuidaRed', icono: 'menu_book' },
  { nombre: 'Preguntas frecuentes', icono: 'help' },
  { nombre: 'Cambiar idioma', icono: 'translate' },
  { nombre: 'Contactar soporte', icono: 'support_agent' },
  { nombre: 'Modo claro u oscuro', icono: 'dark_mode' },
  { nombre: 'Accesibilidad', icono: 'accessibility_new' },
] as const

export function AyudaFlotante() {
  const [abierta, setAbierta] = useState(false)
  const disparador = useRef<HTMLButtonElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  const logo = useLogo('isotipo')
  const restaurarFoco = useCallback(() => disparador.current?.focus(), [])

  useEffect(() => {
    if (!abierta) return
    cerrar.current?.focus()
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setAbierta(false) }
      if (event.key === 'Tab') { event.preventDefault(); cerrar.current?.focus() }
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', tecla)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', tecla)
      queueMicrotask(restaurarFoco)
    }
  }, [abierta, restaurarFoco])

  return <>
    {abierta && <div className="fixed inset-0 z-40 bg-navy/45" aria-hidden="true" onClick={() => setAbierta(false)} />}
    <aside aria-label="Ayuda de CuidaRed" className="pointer-events-none fixed right-4 bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+1rem)] z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 md:right-6 md:bottom-6">
      {abierta && <section role="dialog" aria-modal="true" aria-labelledby="titulo-ayuda-flotante" aria-describedby="estado-ayuda-flotante" id="opciones-ayuda-flotante" className="pointer-events-auto flex max-h-[calc(100dvh-12rem-var(--safe-top))] max-w-full flex-col items-end gap-2 overflow-y-auto pb-1 pl-2">
        <h2 id="titulo-ayuda-flotante" className="sr-only">Opciones de ayuda</h2>
        <p id="estado-ayuda-flotante" className="max-w-72 rounded-sm bg-white px-3 py-2 text-sm text-ink">Estas opciones estarán disponibles próximamente.</p>
        <ul className="grid max-w-full gap-2">
          {opciones.map(opcion => <li key={opcion.nombre} className="flex max-w-full items-center justify-end gap-3">
            <button type="button" disabled className="flex min-h-12 max-w-full items-center justify-end gap-3 text-left disabled:cursor-default" aria-label={opcion.nombre + ' · próximamente'}>
              <span className="max-w-[calc(100vw-7.5rem)] rounded-sm bg-white px-3 py-3 text-sm font-semibold text-ink shadow-2">{opcion.nombre}</span>
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blue-100 text-primary shadow-1"><Icon name={opcion.icono} /></span>
            </button>
          </li>)}
        </ul>
        <button ref={cerrar} type="button" onClick={() => setAbierta(false)} aria-label="Cerrar ayuda" className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-white bg-navy text-white shadow-2 hover:bg-primary"><Icon name="close" size={32} /></button>
      </section>}
      {!abierta && <button ref={disparador} type="button" aria-label="Abrir ayuda de CuidaRed" aria-haspopup="dialog" aria-expanded={false} aria-controls="opciones-ayuda-flotante" onClick={() => setAbierta(true)} className="pointer-events-auto grid size-16 place-items-center rounded-full border-[3px] border-white bg-white p-1.5 shadow-2 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none">
        <img src={logo} alt="" width={149} height={178} className="size-full object-contain" />
      </button>}
    </aside>
  </>
}
