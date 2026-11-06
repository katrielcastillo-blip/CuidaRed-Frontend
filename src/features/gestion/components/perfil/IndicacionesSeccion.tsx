/*
 * IndicacionesSeccion.tsx — Indicaciones médicas del adulto mayor (tabla Indicacion_Medica: Tipo_Indicacion_Id,
 * Titulo, Descripcion, Frecuencia_horario, Fecha_Inicio, Fecha_Fin, Estado, Evidencia).
 *   - indicaciones:ver        consulta en solo lectura (Familiar, Administrador…): vigentes e históricas.
 *   - indicaciones:gestionar  además registra y edita (Coordinador y Cuidador de sus adultos asignados) con
 *                             guardarIndicacion, que valida rol y alcance y deja constancia en auditoría.
 *   - sin indicaciones:ver    (Voluntario) no renderiza nada.
 * Aviso permanente: solo se transcribe lo indicado por personal de salud (Ley 42-01); CuidaRed no diagnostica.
 * Reutilizable desde el área del cuidador: los permisos se resuelven aquí con `puede()`; `gestiona` solo permite
 * RESTRINGIR (p. ej. perfil inactivo), nunca ampliar.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useId, useMemo, useState, type FormEvent } from 'react'
import { CalendarRange, Clock, Paperclip, Pencil, Plus, X } from 'lucide-react'
import { AvisoBorrador, Badge, Button, ChoicePills, SelectField, Sheet, TextareaField, TextField, useToast } from '@/components/ui'
import { DATOS_INDICACION_VACIOS, guardarIndicacion, type DatosIndicacion } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto, IndicacionMedica } from '@/domain/types'
import { useBorradorCompleto } from '@/lib/useBorrador'
import { cn } from '@/lib/cn'
import { nombreCatalogo, nombreUsuario } from '../../lib/datos'
import { ESTADO_INDICACION_TEXTO, ESTADOS_INDICACION, plural, TONO_INDICACION, vigenciaTexto } from '../../lib/formato'
import { NotaInfo, Seccion } from '../Piezas'

type Errores = Partial<Record<keyof DatosIndicacion, string | undefined>>

/** Orden de los campos del formulario (el primero con error recibe el foco). */
const CAMPOS: Array<{ campo: keyof DatosIndicacion; id: string }> = [
  { campo: 'tipoIndicacionId', id: 'ind-tipo' },
  { campo: 'titulo', id: 'ind-titulo' },
  { campo: 'descripcion', id: 'ind-descripcion' },
  { campo: 'frecuenciaHorario', id: 'ind-frecuencia' },
  { campo: 'fechaInicio', id: 'ind-inicio' },
  { campo: 'fechaFin', id: 'ind-fin' },
]

const datosDe = (i: IndicacionMedica): DatosIndicacion => ({
  tipoIndicacionId: i.tipoIndicacionId,
  titulo: i.titulo,
  descripcion: i.descripcion,
  frecuenciaHorario: i.frecuenciaHorario,
  fechaInicio: i.fechaInicio,
  fechaFin: i.fechaFin ?? '',
  estado: i.estado,
  evidencia: i.evidencia ?? '',
})

/** Formulario de registro y edición (dentro de la hoja). Conserva lo escrito si se cierra o falla (useBorrador). */
function FormularioIndicacion({ adulto, indicacion, onCerrar }: { adulto: Adulto; indicacion?: IndicacionMedica; onCerrar: () => void }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const archivoId = useId()
  const tipos = useDB((s) => s.catalogos.tiposIndicacion)
  const inicial = useMemo<DatosIndicacion>(() => (indicacion ? datosDe(indicacion) : { ...DATOS_INDICACION_VACIOS, fechaInicio: todayISO() }), [indicacion])
  const borrador = useBorradorCompleto<DatosIndicacion>(`indicacion:${adulto.id}:${indicacion?.id ?? 'nueva'}`, inicial)
  const { valor: datos, setValor: setDatos } = borrador
  const [errores, setErrores] = useState<Errores>({})

  const set = <K extends keyof DatosIndicacion>(k: K, v: DatosIndicacion[K]) => {
    setDatos((d) => ({ ...d, [k]: v }))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    const r = guardarIndicacion(user, adulto.id, datos, indicacion?.id)
    if (!r.ok) {
      const e = (r.errores ?? {}) as Errores
      setErrores(e)
      toast(r.error, 'error')
      const primero = CAMPOS.find((c) => e[c.campo])
      if (primero) requestAnimationFrame(() => document.getElementById(primero.id)?.focus())
      return
    }
    borrador.descartar()
    toast(indicacion ? 'Indicación actualizada' : 'Indicación registrada')
    onCerrar()
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={guardar} noValidate>
      <AvisoBorrador formulario={{ borradorRecuperado: borrador.recuperado, descartarBorrador: borrador.reiniciar, cerrarAvisoBorrador: borrador.cerrarAviso }} />
      <NotaInfo tono="aviso">Solo transcribe lo indicado por personal de salud. No agregues diagnósticos ni cambies dosis por tu cuenta.</NotaInfo>
      <SelectField
        id="ind-tipo"
        label="Tipo de indicación"
        required
        placeholder="Seleccionar"
        value={datos.tipoIndicacionId}
        onChange={(e) => set('tipoIndicacionId', e.target.value)}
        options={tipos.map((t) => ({ value: t.id, label: t.nombre }))}
        error={errores.tipoIndicacionId}
      />
      <TextField id="ind-titulo" label="Título" required autoComplete="off" maxLength={80} placeholder="Ej.: Losartán 50 mg" value={datos.titulo} onChange={(e) => set('titulo', e.target.value)} error={errores.titulo} />
      <TextareaField
        id="ind-descripcion"
        label="Descripción"
        required
        rows={3}
        maxLength={300}
        placeholder="Transcribe la indicación tal como la dio el personal de salud."
        value={datos.descripcion}
        onChange={(e) => set('descripcion', e.target.value)}
        error={errores.descripcion}
        hint={`${datos.descripcion.length}/300`}
        help="Escribe lo que indicó el médico, la enfermera u otro personal de salud, con sus mismas palabras."
      />
      <TextField
        id="ind-frecuencia"
        label="Frecuencia u horario"
        required
        autoComplete="off"
        maxLength={60}
        placeholder="Ej.: Diario · 8:00 a.m."
        value={datos.frecuenciaHorario}
        onChange={(e) => set('frecuenciaHorario', e.target.value)}
        error={errores.frecuenciaHorario}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="ind-inicio" label="Inicio" required type="date" value={datos.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} error={errores.fechaInicio} />
        <TextField id="ind-fin" label="Fin" type="date" min={datos.fechaInicio || undefined} value={datos.fechaFin} onChange={(e) => set('fechaFin', e.target.value)} error={errores.fechaFin} hint="Opcional" />
      </div>
      <ChoicePills<IndicacionMedica['estado']>
        label="Estado"
        value={datos.estado}
        onChange={(v) => set('estado', v)}
        options={ESTADOS_INDICACION}
        help="Vigente: se sigue aplicando. Suspendida: se detuvo por ahora. Finalizada: terminó el tratamiento."
      />
      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-ink">Documento de respaldo</span>
        {datos.evidencia ? (
          <div className="flex items-center gap-2 pl-3 rounded-sm border border-line-soft bg-surface">
            <Paperclip size={18} className="flex-none text-navy" aria-hidden />
            <span className="flex-1 min-w-0 text-sm wrap-anywhere">{datos.evidencia}</span>
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
      {!enLinea && <NotaInfo tono="aviso">Sin conexión: guardar indicaciones necesita internet. Lo escrito se conserva en esta pantalla.</NotaInfo>}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <Button variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!enLinea}>
          Guardar
        </Button>
      </div>
    </form>
  )
}

function Tarjeta({ i, edita, enLinea, onEditar }: { i: IndicacionMedica; edita: boolean; enLinea: boolean; onEditar: () => void }) {
  const tipos = useDB((s) => s.catalogos.tiposIndicacion)
  const usuarios = useDB((s) => s.usuarios)
  return (
    <li className={cn('flex flex-col gap-1.5 p-3 rounded-sm border bg-surface', i.estado === 'vigente' ? 'border-line' : 'border-line-soft')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{nombreCatalogo(tipos, i.tipoIndicacionId)}</span>
          <strong className="text-base text-ink wrap-anywhere">{i.titulo}</strong>
        </div>
        <Badge tone={TONO_INDICACION[i.estado]}>{ESTADO_INDICACION_TEXTO[i.estado]}</Badge>
      </div>
      <p className="text-sm text-ink-2 wrap-anywhere">{i.descripcion}</p>
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
        <span className="text-xs text-muted">
          Registrada por {nombreUsuario(usuarios, i.registradaPor) ?? '—'} · actualizada el {fechaCorta(i.actualizadoEn)}
        </span>
        {edita && (
          <button type="button" className="size-12 grid place-items-center flex-none rounded-full text-navy hover:bg-blue-100 disabled:opacity-50" aria-label={`Editar indicación ${i.titulo}`} onClick={onEditar} disabled={!enLinea}>
            <Pencil size={18} aria-hidden />
          </button>
        )}
      </div>
    </li>
  )
}

export function IndicacionesSeccion({ adulto, gestiona = true, className }: { adulto: Adulto; gestiona?: boolean; className?: string }) {
  const user = useUser()
  const enLinea = useEnLinea()
  const todas = useDB((s) => s.indicaciones)
  const lista = useMemo(() => todas.filter((i) => i.adultoId === adulto.id).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)), [todas, adulto.id])
  const vigentes = useMemo(() => lista.filter((i) => i.estado === 'vigente'), [lista])
  const historicas = useMemo(() => lista.filter((i) => i.estado !== 'vigente'), [lista])

  // null = cerrada · 'nueva' = registrar · indicación = editar.
  const [editando, setEditando] = useState<'nueva' | IndicacionMedica | null>(null)
  const cerrar = useCallback(() => setEditando(null), [])

  // Sin indicaciones:ver (p. ej. Voluntario) no se muestra nada.
  if (!puede(user, 'indicaciones:ver', adulto)) return null
  const edita = gestiona && adulto.estado === 'activo' && puede(user, 'indicaciones:gestionar', adulto)

  return (
    <Seccion
      titulo="Indicaciones médicas"
      id="indicaciones"
      className={className}
      accion={
        edita && (
          <Button size="sm" variant="light" icon={<Plus size={18} aria-hidden />} onClick={() => setEditando('nueva')} disabled={!enLinea}>
            Nueva
          </Button>
        )
      }
    >
      <NotaInfo tono="aviso">
        <b>Solo transcribe lo indicado por personal de salud.</b> CuidaRed no diagnostica ni sustituye al médico tratante.{!edita && ' Aquí solo puedes consultarlas.'}
      </NotaInfo>
      {lista.length === 0 ? (
        <p className="text-sm text-muted">Sin indicaciones registradas.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-bold text-navy">Vigentes ({vigentes.length})</h3>
            {vigentes.length === 0 ? (
              <p className="text-sm text-muted">No hay indicaciones vigentes.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {vigentes.map((i) => (
                  <Tarjeta key={i.id} i={i} edita={edita} enLinea={enLinea} onEditar={() => setEditando(i)} />
                ))}
              </ul>
            )}
          </div>
          {historicas.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-bold text-navy">Históricas ({historicas.length})</h3>
              <p className="text-xs text-muted -mt-1">{plural(historicas.length, 'indicación suspendida o finalizada', 'indicaciones suspendidas o finalizadas')}.</p>
              <ul className="flex flex-col gap-2">
                {historicas.map((i) => (
                  <Tarjeta key={i.id} i={i} edita={edita} enLinea={enLinea} onEditar={() => setEditando(i)} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Sheet open={edita && editando !== null} onClose={cerrar} title={editando && editando !== 'nueva' ? 'Editar indicación' : 'Nueva indicación médica'}>
        {editando !== null && <FormularioIndicacion key={editando === 'nueva' ? 'nueva' : editando.id} adulto={adulto} indicacion={editando === 'nueva' ? undefined : editando} onCerrar={cerrar} />}
      </Sheet>
    </Seccion>
  )
}
