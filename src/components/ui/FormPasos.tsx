/*
 * FormPasos.tsx — Formulario multipaso para móvil (CR-178): barra de progreso (StepBar), Anterior/Siguiente con
 * validación por paso, foco al primer campo inválido, aviso de borrador recuperado y envío final.
 * Se usa junto a `useFormulario`. Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *   const f = useFormulario({ clave: 'adulto:nuevo', inicial, reglas })
 *   <FormPasos
 *     titulo="Registrar adulto mayor"
 *     formulario={f}
 *     pasos={[
 *       { id: 'id', titulo: 'Identificación', campos: ['nombre', 'cedula'], contenido: <>…campos…</> },
 *       { id: 'contacto', titulo: 'Contacto', campos: ['telefono'], contenido: <>…campos…</> },
 *     ]}
 *     alGuardar={(v) => crearAdulto(user, v)}
 *     textoGuardar="Registrar"
 *     onCancelar={() => navigate(-1)}
 *   />
 * Cada paso debe caber en un solo desplazamiento a 360×640 y tener como máximo 5 campos de texto libre (RF-06).
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { History } from 'lucide-react'
import { avisar } from '@/domain/avisos'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { StepBar } from './Display'
import type { Formulario } from './useFormulario'

/* ───────────── Aviso de borrador ───────────── */
interface FuenteBorrador {
  borradorRecuperado: boolean
  descartarBorrador: () => void
  cerrarAvisoBorrador: () => void
}

/**
 * "Recuperamos lo que estabas escribiendo" con las opciones Descartar (empezar de nuevo) y Seguir editando.
 * Solo se ve si al abrir el formulario se restauró un borrador. `FormPasos` lo incluye; en otros formularios
 * úsalo con `<AvisoBorrador formulario={f} />`.
 */
export function AvisoBorrador({ formulario, className }: { formulario: FuenteBorrador; className?: string }) {
  if (!formulario.borradorRecuperado) return null
  return (
    <div role="status" className={cn('flex flex-col gap-2 rounded-sm border border-blue bg-info-100 p-3 text-navy', className)}>
      <p className="flex items-start gap-2 font-semibold">
        <History size={20} className="mt-0.5 flex-none" aria-hidden />
        <span>Recuperamos lo que estabas escribiendo.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Descartar el borrador y empezar de nuevo"
          onClick={() => {
            formulario.descartarBorrador()
            avisar('Se descartó el borrador.', 'info')
          }}
        >
          Descartar
        </Button>
        <Button variant="ghost" size="sm" onClick={formulario.cerrarAvisoBorrador}>
          Seguir editando
        </Button>
      </div>
    </div>
  )
}

/* ───────────── FormPasos ───────────── */
export interface PasoFormulario<T extends object> {
  id: string
  titulo: string
  /** Frase breve bajo el título del paso. */
  descripcion?: string
  /** Campos de este paso: se validan al pulsar "Siguiente" y el primero inválido recibe el foco. */
  campos: Array<keyof T & string>
  contenido: ReactNode
}

export interface FormPasosProps<T extends object> {
  formulario: Formulario<T>
  pasos: Array<PasoFormulario<T>>
  /** Se llama con los valores cuando todo es válido (puede ser asíncrona; ver `Formulario.enviar`). */
  alGuardar: (valores: T) => unknown
  titulo?: string
  /** Texto bajo el título, solo en el primer paso. */
  intro?: string
  textoGuardar?: string
  textoSiguiente?: string
  textoAnterior?: string
  textoCancelar?: string
  /** Si se indica, el primer paso muestra "Cancelar" en lugar de "Anterior". */
  onCancelar?: () => void
  /** Deshabilita el botón de guardar (p. ej. sin conexión). */
  guardarDeshabilitado?: boolean
  /** Explica por qué no se puede guardar (se muestra sobre los botones y se asocia al botón). */
  motivoDeshabilitado?: ReactNode
  /** Contenido extra sobre los botones del paso (avisos de conexión, notas). */
  pie?: ReactNode
  /** Paso con el que se abre (0 = primero). */
  pasoInicial?: number
  className?: string
}

export function FormPasos<T extends object>({
  formulario: f,
  pasos,
  alGuardar,
  titulo,
  intro,
  textoGuardar = 'Guardar',
  textoSiguiente = 'Siguiente',
  textoAnterior = 'Anterior',
  textoCancelar = 'Cancelar',
  onCancelar,
  guardarDeshabilitado,
  motivoDeshabilitado,
  pie,
  pasoInicial = 0,
  className,
}: FormPasosProps<T>) {
  const [indice, setIndice] = useState(Math.min(Math.max(pasoInicial, 0), pasos.length - 1))
  const estado = useRef<HTMLParagraphElement>(null)
  const primeraVez = useRef(true)
  /** true si el cambio de paso lo provocó un error: el foco va al campo inválido, no al encabezado. */
  const pasoPorError = useRef(false)
  const idMotivo = `${f.prefijo}-motivo`
  const paso = pasos[indice]!
  const ultimo = indice === pasos.length - 1

  // Al cambiar de paso: se anuncia el paso nuevo (foco en el encabezado) y se vuelve al inicio de la pantalla.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    if (pasoPorError.current) {
      pasoPorError.current = false
      return
    }
    window.scrollTo({ top: 0 })
    estado.current?.focus({ preventScroll: true })
  }, [indice])

  const irAlPasoDe = (campo: string) => {
    const i = pasos.findIndex((p) => (p.campos as string[]).includes(campo))
    if (i >= 0 && i !== indice) {
      pasoPorError.current = true
      setIndice(i)
    }
  }

  const siguiente = () => {
    if (f.validarCampos(paso.campos)) setIndice((i) => Math.min(i + 1, pasos.length - 1))
  }

  const guardar = async () => {
    // Validación completa: si el primer error está en otro paso, se vuelve a él.
    const primero = await f.enviar(alGuardar)()
    if (primero) irAlPasoDe(primero)
  }

  const alEnviar = (e: FormEvent) => {
    e.preventDefault()
    if (ultimo) void guardar()
    else siguiente()
  }

  return (
    <form className={cn('flex flex-col gap-4 w-full max-w-form mx-auto', className)} onSubmit={alEnviar} noValidate>
      <div className="flex flex-col gap-2">
        {titulo && <h2 className="text-2xl font-bold text-ink">{titulo}</h2>}
        {intro && indice === 0 && <p className="text-sm text-ink-2">{intro}</p>}
        <p ref={estado} tabIndex={-1} aria-live="polite" className="flex items-center justify-between gap-3 text-sm font-semibold text-navy outline-none">
          <span>
            Paso {indice + 1} de {pasos.length} · {paso.titulo}
          </span>
          <span className="text-muted font-normal">* Obligatorio</span>
        </p>
        <StepBar step={indice + 1} total={pasos.length} />
      </div>

      <AvisoBorrador formulario={f} />

      <fieldset key={paso.id} className="flex flex-col gap-4 border-0 p-0 m-0 min-w-0">
        <legend className="sr-only">{paso.titulo}</legend>
        {paso.descripcion && <p className="text-sm text-ink-2">{paso.descripcion}</p>}
        {paso.contenido}
      </fieldset>

      {pie}

      {ultimo && guardarDeshabilitado && motivoDeshabilitado && (
        <p id={idMotivo} className="text-sm font-semibold text-warning-700" role="status">
          {motivoDeshabilitado}
        </p>
      )}

      <div className={cn('grid gap-3', indice > 0 || onCancelar ? 'grid-cols-2' : 'grid-cols-1')}>
        {indice > 0 ? (
          <Button variant="light" onClick={() => setIndice((i) => i - 1)}>
            {textoAnterior}
          </Button>
        ) : (
          onCancelar && (
            <Button variant="light" onClick={onCancelar}>
              {textoCancelar}
            </Button>
          )
        )}
        {ultimo ? (
          <Button type="submit" loading={f.enviando} disabled={guardarDeshabilitado} aria-describedby={guardarDeshabilitado && motivoDeshabilitado ? idMotivo : undefined}>
            {textoGuardar}
          </Button>
        ) : (
          <Button type="submit">{textoSiguiente}</Button>
        )}
      </div>
    </form>
  )
}
