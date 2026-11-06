/*
 * RepeticionCampos.tsx — Repetición de una tarea: "No se repite / Diaria / Semanal (días)", días de la semana, fecha
 * de fin obligatoria (con un tope de MAX_OCURRENCIAS tareas) y vista previa "Se crearán N tareas: …". Cada
 * ocurrencia se guarda como una tarea individual.
 * Módulo: agenda.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ChangeEventHandler } from 'react'
import { Check } from 'lucide-react'
import { ChoicePills, TextField } from '@/components/ui'
import { fechasDeSerie, MAX_OCURRENCIAS, type DatosTarea, type Repeticion } from '@/domain/api'
import { cn } from '@/lib/cn'
import { DIAS_SEMANA, fechaDiaCorta, horaTarea, sumarDias } from '../lib/agenda'

const OPCIONES: Array<{ value: Repeticion; label: string }> = [
  { value: 'ninguna', label: 'No se repite' },
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
]

type Valores = Pick<DatosTarea, 'fechaProgramada' | 'horaProgramada' | 'repeticion' | 'diasSemana' | 'fechaFin'>

interface CampoControl<V> {
  id: string
  value: V
  onChange: (v: V) => void
  error?: string
}

export function RepeticionCampos({
  valores,
  repeticion,
  diasSemana,
  fechaFin,
  nombreCuidador,
}: {
  valores: Valores
  repeticion: CampoControl<Repeticion>
  diasSemana: CampoControl<number[]>
  fechaFin: { id: string; value: string; onChange: ChangeEventHandler<HTMLInputElement>; onBlur: () => void; error?: string }
  nombreCuidador?: string
}) {
  const seRepite = repeticion.value !== 'ninguna'
  // Máximo razonable para el selector: un año desde el inicio (el tope real son MAX_OCURRENCIAS tareas).
  const maxFin = valores.fechaProgramada ? sumarDias(valores.fechaProgramada, 365) : undefined

  return (
    <div className="flex flex-col gap-4">
      <ChoicePills<Repeticion>
        label="Repetición"
        required
        id={repeticion.id}
        value={repeticion.value}
        onChange={repeticion.onChange}
        options={OPCIONES}
        error={repeticion.error}
        help="Con una repetición se crea una tarea por cada día: cada una se inicia, se completa, se valida y se cancela por separado."
      />

      {repeticion.value === 'semanal' && <DiasSemana id={diasSemana.id} value={diasSemana.value} onChange={diasSemana.onChange} error={diasSemana.error} />}

      {seRepite && (
        <TextField
          label="Se repite hasta"
          type="date"
          required
          id={fechaFin.id}
          min={valores.fechaProgramada || undefined}
          max={maxFin}
          value={fechaFin.value}
          onChange={fechaFin.onChange}
          onBlur={fechaFin.onBlur}
          error={fechaFin.error}
          hint={`Última fecha de la repetición (inclusive). Máximo ${MAX_OCURRENCIAS} tareas.`}
        />
      )}

      <VistaPreviaSerie valores={valores} nombreCuidador={nombreCuidador} />
    </div>
  )
}

/** Días de la semana (lunes a domingo) como casillas de 48 px. */
function DiasSemana({ id, value, onChange, error }: { id: string; value: number[]; onChange: (v: number[]) => void; error?: string }) {
  const alternar = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)))
  return (
    <fieldset id={id} className="flex flex-col gap-2 min-w-0 border-0 p-0 m-0" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="text-base font-semibold text-ink mb-2">
        Días de la semana
        <span aria-hidden> *</span>
        <span className="sr-only"> (obligatorio)</span>
      </legend>
      <div className="grid grid-cols-4 gap-2 min-[480px]:grid-cols-7">
        {DIAS_SEMANA.map((d) => {
          const on = value.includes(d.value)
          return (
            <label
              key={d.value}
              className={cn(
                'flex items-center justify-center gap-1.5 min-h-12 px-2 rounded-sm border cursor-pointer text-sm font-semibold select-none',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue',
                on ? 'bg-navy border-navy text-white' : 'bg-bg border-line text-ink-2',
                error && !on && 'border-danger',
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => alternar(d.value)} aria-label={d.largo} />
              {on && <Check size={14} strokeWidth={3} aria-hidden />}
              <span aria-hidden>{d.label}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** "Se crearán 12 tareas: jue 6 nov, vie 7 nov … vie 20 nov" + lista completa desplegable. */
export function VistaPreviaSerie({ valores, nombreCuidador }: { valores: Valores; nombreCuidador?: string }) {
  const fechas = fechasDeSerie(valores)
  const seRepite = valores.repeticion !== 'ninguna'
  const hora = /^\d{2}:\d{2}$/.test(valores.horaProgramada) ? ` a las ${horaTarea(valores.horaProgramada)}` : ''

  if (fechas.length === 0) {
    return seRepite ? (
      <p className="p-3 rounded-sm bg-surface-2 text-sm text-muted" role="status">
        Elige {valores.repeticion === 'semanal' ? 'los días y ' : ''}la fecha de fin para ver cuántas tareas se crearán.
      </p>
    ) : null
  }

  const excede = fechas.length > MAX_OCURRENCIAS
  const n = excede ? `más de ${MAX_OCURRENCIAS}` : String(fechas.length)
  const resumen =
    fechas.length <= 4 && !excede
      ? fechas.map(fechaDiaCorta).join(', ')
      : `${fechas.slice(0, 3).map(fechaDiaCorta).join(', ')} … ${fechaDiaCorta(fechas[Math.min(fechas.length, MAX_OCURRENCIAS) - 1]!)}`

  return (
    <div className={cn('flex flex-col gap-2 p-3 rounded-sm border text-sm text-ink', excede ? 'bg-danger-100 border-danger' : 'bg-blue-100 border-blue')} role="status">
      <p className="font-semibold">
        {excede
          ? `Esta repetición crearía ${n} tareas y el máximo es ${MAX_OCURRENCIAS}. Acorta la fecha de fin.`
          : `${fechas.length === 1 ? 'Se creará 1 tarea' : `Se crearán ${n} tareas`}${hora}: ${resumen}`}
      </p>
      {seRepite && !excede && (
        <p className="text-ink-2">
          Cada ocurrencia es una tarea individual{nombreCuidador ? ` y se asigna a ${nombreCuidador}` : ''}: se inicia, se completa y se cancela por separado.
        </p>
      )}
      {fechas.length > 4 && !excede && (
        <details className="group">
          <summary className="inline-flex items-center min-h-12 font-semibold text-navy cursor-pointer underline underline-offset-2">Ver todas las fechas</summary>
          <ol className="grid grid-cols-2 gap-x-3 gap-y-1 m-0 pl-5 pb-1 text-ink-2 min-[480px]:grid-cols-3">
            {fechas.map((f) => (
              <li key={f}>{fechaDiaCorta(f)}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}
