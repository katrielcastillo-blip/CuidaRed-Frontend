/*
 * IndicacionesSeccion.tsx — Indicaciones médicas del adulto mayor (tabla Indicacion_Medica: Tipo_Indicacion_Id,
 * Titulo, Descripcion, Frecuencia_horario, Fecha_Inicio, Fecha_Fin, Estado, Evidencia). Solo se muestra con
 * permiso indicaciones:ver; con indicaciones:gestionar se crean y editan (guardarIndicacion) en una hoja.
 * Solo se transcribe lo indicado por personal de salud: CuidaRed no es un expediente clínico (Ley 42-01).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useId, useMemo, useState, type FormEvent } from 'react'
import { CalendarRange, Clock, Paperclip, Pencil, Plus, X } from 'lucide-react'
import { Badge, Button, ChoicePills, SelectField, Sheet, TextareaField, TextField, useToast } from '@/components/ui'
import { DATOS_INDICACION_VACIOS, guardarIndicacion, type DatosIndicacion } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto, IndicacionMedica } from '@/domain/types'
import { cn } from '@/lib/cn'
import { nombreCatalogo, nombreUsuario } from '../../lib/datos'
import { ESTADO_INDICACION_TEXTO, ESTADOS_INDICACION, TONO_INDICACION, vigenciaTexto } from '../../lib/formato'
import { NotaInfo, Seccion } from '../Piezas'

type Errores = Partial<Record<keyof DatosIndicacion, string | undefined>>
const ORDEN: Record<IndicacionMedica['estado'], number> = { vigente: 0, suspendida: 1, finalizada: 2 }

export function IndicacionesSeccion({ adulto, gestiona, className }: { adulto: Adulto; gestiona: boolean; className?: string }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const archivoId = useId()
  const todas = useDB((s) => s.indicaciones)
  const tipos = useDB((s) => s.catalogos.tiposIndicacion)
  const usuarios = useDB((s) => s.usuarios)
  const lista = useMemo(
    () => todas.filter((i) => i.adultoId === adulto.id).sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || b.fechaInicio.localeCompare(a.fechaInicio)),
    [todas, adulto.id],
  )

  const [form, setForm] = useState<{ id?: string; datos: DatosIndicacion } | null>(null)
  const [errores, setErrores] = useState<Errores>({})
  const cerrar = useCallback(() => {
    setForm(null)
    setErrores({})
  }, [])

  const abrir = (i?: IndicacionMedica) =>
    setForm(
      i
        ? {
            id: i.id,
            datos: {
              tipoIndicacionId: i.tipoIndicacionId,
              titulo: i.titulo,
              descripcion: i.descripcion,
              frecuenciaHorario: i.frecuenciaHorario,
              fechaInicio: i.fechaInicio,
              fechaFin: i.fechaFin ?? '',
              estado: i.estado,
              evidencia: i.evidencia ?? '',
            },
          }
        : { datos: { ...DATOS_INDICACION_VACIOS, fechaInicio: todayISO() } },
    )

  const set = <K extends keyof DatosIndicacion>(k: K, v: DatosIndicacion[K]) => {
    setForm((f) => (f ? { ...f, datos: { ...f.datos, [k]: v } } : f))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!form) return
    const r = guardarIndicacion(user, adulto.id, form.datos, form.id)
    if (!r.ok) {
      setErrores((r.errores ?? {}) as Errores)
      toast(r.error, 'error')
      return
    }
    toast(form.id ? 'Indicación actualizada' : 'Indicación registrada')
    cerrar()
  }

  return (
    <Seccion
      titulo="Indicaciones médicas"
      id="indicaciones"
      className={className}
      accion={
        gestiona && (
          <Button size="sm" variant="light" icon={<Plus size={18} aria-hidden />} onClick={() => abrir()} disabled={!enLinea}>
            Nueva
          </Button>
        )
      }
    >
      <NotaInfo tono="aviso">Registra solo lo indicado por personal de salud; CuidaRed no es un expediente clínico.</NotaInfo>
      {lista.length === 0 ? (
        <p className="text-sm text-muted">Sin indicaciones registradas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((i) => (
            <li key={i.id} className={cn('flex flex-col gap-1.5 p-3 rounded-sm border bg-surface', i.estado === 'vigente' ? 'border-line' : 'border-line-soft opacity-85')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">{nombreCatalogo(tipos, i.tipoIndicacionId)}</span>
                  <strong className="text-base text-ink wrap-anywhere">{i.titulo}</strong>
                </div>
                <Badge tone={TONO_INDICACION[i.estado]}>{ESTADO_INDICACION_TEXTO[i.estado]}</Badge>
              </div>
              <p className="text-sm text-ink-2">{i.descripcion}</p>
              <p className="flex flex-col gap-1 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-4">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={15} aria-hidden /> {i.frecuenciaHorario}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange size={15} aria-hidden /> {vigenciaTexto(i)}
                </span>
                {i.evidencia && (
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Paperclip size={15} aria-hidden /> <span className="wrap-anywhere">Respaldo: {i.evidencia}</span>
                  </span>
                )}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">Registrada por {nombreUsuario(usuarios, i.registradaPor) ?? '—'}</span>
                {gestiona && (
                  <button type="button" className="size-12 grid place-items-center rounded-full text-navy hover:bg-blue-100 disabled:opacity-50" aria-label={`Editar indicación ${i.titulo}`} onClick={() => abrir(i)} disabled={!enLinea}>
                    <Pencil size={18} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!form} onClose={cerrar} title={form?.id ? 'Editar indicación' : 'Nueva indicación médica'}>
        {form && (
          <form className="flex flex-col gap-3" onSubmit={guardar} noValidate>
            <SelectField
              label="Tipo de indicación"
              required
              placeholder="Seleccionar"
              value={form.datos.tipoIndicacionId}
              onChange={(e) => set('tipoIndicacionId', e.target.value)}
              options={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
              error={errores.tipoIndicacionId}
            />
            <TextField label="Título" required autoComplete="off" maxLength={80} placeholder="Ej.: Losartán 50 mg" value={form.datos.titulo} onChange={(e) => set('titulo', e.target.value)} error={errores.titulo} />
            <TextareaField
              label="Descripción"
              required
              rows={3}
              maxLength={300}
              placeholder="Transcribe la indicación tal como la dio el personal de salud."
              value={form.datos.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              error={errores.descripcion}
              hint={`${form.datos.descripcion.length}/300`}
            />
            <TextField
              label="Frecuencia u horario"
              required
              autoComplete="off"
              maxLength={60}
              placeholder="Ej.: Diario · 8:00 a.m."
              value={form.datos.frecuenciaHorario}
              onChange={(e) => set('frecuenciaHorario', e.target.value)}
              error={errores.frecuenciaHorario}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Inicio" required type="date" value={form.datos.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} error={errores.fechaInicio} />
              <TextField label="Fin" type="date" min={form.datos.fechaInicio || undefined} value={form.datos.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} error={errores.fechaFin} hint="Opcional" />
            </div>
            <ChoicePills<IndicacionMedica['estado']> label="Estado" value={form.datos.estado} onChange={(v) => set('estado', v)} options={ESTADOS_INDICACION} />
            <div className="flex flex-col gap-2">
              <span className="text-base font-semibold text-ink">Documento de respaldo</span>
              {form.datos.evidencia ? (
                <div className="flex items-center gap-2 pl-3 rounded-sm border border-line-soft bg-surface">
                  <Paperclip size={18} className="flex-none text-navy" aria-hidden />
                  <span className="flex-1 min-w-0 text-sm wrap-anywhere">{form.datos.evidencia}</span>
                  <button type="button" className="size-12 grid place-items-center flex-none rounded-full text-danger hover:bg-danger-100" aria-label="Quitar documento" onClick={() => set('evidencia', '')}>
                    <X size={18} aria-hidden />
                  </button>
                </div>
              ) : (
                <label htmlFor={archivoId} className="inline-flex items-center justify-center gap-2 min-h-12 px-4 rounded-[10px] border-2 border-dashed border-blue bg-blue-100 text-navy font-semibold cursor-pointer focus-within:outline-3 focus-within:outline-blue">
                  <Paperclip size={18} aria-hidden /> Adjuntar receta o indicación escrita
                  <input id={archivoId} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => set('evidencia', e.target.files?.[0]?.name ?? '')} />
                </label>
              )}
              <p className="text-sm text-muted">Opcional · foto o PDF de la receta (se guarda el nombre del archivo).</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!enLinea}>
                Guardar
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </Seccion>
  )
}
