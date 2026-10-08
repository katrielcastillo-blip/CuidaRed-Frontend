import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarPlus } from 'lucide-react'
import { Button, ButtonLink, IconTile, RiesgoBadge, SelectField, SuccessOverlay, TextareaField, TextField } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import { pad, todayISO } from '@/domain/dates'
import { mutate, uid } from '@/domain/store'
import type { Visita } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { useOrgData } from './lib/datos'
import styles from './ProgramarVisitaPage.module.css'

const TIPOS = ['Visita de Seguimiento', 'Visita de Evaluación', 'Visita de Entrega de Apoyo']

interface Form {
  adultoId: string
  cuidadorId: string
  tipo: string
  fecha: string
  hora: string
  notas: string
}
type Errores = Partial<Record<keyof Form, string>>

const ahoraHHMM = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Programar visita (ruta propia del coordinador: visitas/programar[?adulto=:id]).
 * El Figma solo tiene el botón en "Mis Visitas": el formulario sigue el patrón de los demás formularios del sistema.
 * Crea una Visita pendiente en el store y vuelve a la lista (pestaña Hoy o Próximas).
 */
export function ProgramarVisitaPage() {
  const { base } = useShell()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { adultos, adultoPorId, cuidadores, visitas } = useOrgData()

  const adultosActivos = useMemo(() => adultos.filter((a) => a.estado === 'activo'), [adultos])
  const cuidadoresActivos = useMemo(() => cuidadores.filter((c) => c.estado === 'activo'), [cuidadores])

  const asignados = (adultoId: string) => {
    const a = adultoPorId.get(adultoId)
    return a ? cuidadoresActivos.filter((c) => a.cuidadorIds.includes(c.id)) : []
  }

  const [form, setForm] = useState<Form>(() => {
    const pre = params.get('adulto') ?? ''
    const adultoId = adultosActivos.some((a) => a.id === pre) ? pre : ''
    return { adultoId, cuidadorId: asignados(adultoId)[0]?.id ?? '', tipo: TIPOS[0]!, fecha: todayISO(), hora: '', notas: '' }
  })
  const [cuidadorElegido, setCuidadorElegido] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [ok, setOk] = useState<{ tab: 'hoy' | 'proximas' } | null>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const adulto = adultoPorId.get(form.adultoId)

  const onAdulto = (adultoId: string) => {
    setForm((f) => ({ ...f, adultoId, cuidadorId: cuidadorElegido && f.cuidadorId ? f.cuidadorId : (asignados(adultoId)[0]?.id ?? f.cuidadorId) }))
    setErrores((e) => ({ ...e, adultoId: undefined }))
  }

  // Los cuidadores asignados al adulto van primero.
  const opcionesCuidador = useMemo(() => {
    const ids = new Set(adulto?.cuidadorIds ?? [])
    const orden = [...cuidadoresActivos].sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)))
    return orden.map((c) => ({ value: c.id, label: ids.has(c.id) ? `${nombreCompleto(c)} · asignado` : nombreCompleto(c) }))
  }, [cuidadoresActivos, adulto])

  const validar = (): Errores => {
    const e: Errores = {}
    if (!form.adultoId) e.adultoId = 'Selecciona el adulto mayor.'
    if (!form.cuidadorId) e.cuidadorId = 'Asigna un cuidador.'
    if (!form.tipo.trim()) e.tipo = 'Indica el tipo de visita.'
    if (!form.fecha) e.fecha = 'Indica la fecha.'
    else if (form.fecha < todayISO()) e.fecha = 'La fecha no puede ser anterior a hoy.'
    if (!form.hora) e.hora = 'Indica la hora pautada.'
    else if (form.fecha === todayISO() && form.hora < ahoraHHMM()) e.hora = 'Esa hora ya pasó. Elige una hora posterior.'
    else if (
      form.cuidadorId &&
      visitas.some((v) => v.cuidadorId === form.cuidadorId && v.fecha === form.fecha && v.horaPautada === form.hora && v.estado !== 'cancelada')
    )
      e.hora = 'Ese cuidador ya tiene una visita a esa hora.'
    return e
  }

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length > 0) return
    const visita: Visita = {
      id: uid('v'),
      adultoId: form.adultoId,
      cuidadorId: form.cuidadorId,
      tipo: form.tipo.trim(),
      fecha: form.fecha,
      horaPautada: form.hora,
      estado: 'pendiente',
      notas: form.notas.trim() || undefined,
      evidencias: [],
    }
    mutate((db) => {
      db.visitas.push(visita)
    })
    setOk({ tab: form.fecha === todayISO() ? 'hoy' : 'proximas' })
  }

  const volver = `${base}/visitas`

  return (
    <Page title="Programar visita" back={volver}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {adulto && (
          <div className={styles.resumen}>
            <IconTile size={56} />
            <div className={styles.resumenInfo}>
              <strong>{nombreCompleto(adulto)}</strong>
              <div className="row">
                <RiesgoBadge riesgo={adulto.riesgo} />
                <span className={styles.zona}>{adulto.zona}</span>
              </div>
              <Link to={`${base}/adultos/${adulto.id}`} className={styles.perfil}>
                Ver perfil completo <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        )}

        <SelectField
          label="Adulto mayor"
          required
          placeholder="Selecciona un adulto"
          value={form.adultoId}
          onChange={(e) => onAdulto(e.target.value)}
          options={adultosActivos.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
          error={errores.adultoId}
        />

        <SelectField
          label="Cuidador asignado"
          required
          placeholder="Selecciona un cuidador"
          value={form.cuidadorId}
          onChange={(e) => {
            setCuidadorElegido(true)
            set('cuidadorId', e.target.value)
          }}
          options={opcionesCuidador}
          error={errores.cuidadorId}
          hint={adulto && asignados(adulto.id).length === 0 ? 'Este adulto aún no tiene cuidador asignado.' : undefined}
        />

        <SelectField label="Tipo de visita" required value={form.tipo} onChange={(e) => set('tipo', e.target.value)} options={TIPOS} error={errores.tipo} />

        <div className={styles.dos}>
          <TextField label="Fecha" type="date" required min={todayISO()} value={form.fecha} onChange={(e) => set('fecha', e.target.value)} error={errores.fecha} />
          <TextField label="Hora pautada" type="time" required value={form.hora} onChange={(e) => set('hora', e.target.value)} error={errores.hora} />
        </div>

        <TextareaField
          label="Notas para el cuidador"
          placeholder="Instrucciones previas: verificar estado general, llevar tensiómetro…"
          value={form.notas}
          onChange={(e) => set('notas', e.target.value)}
          hint="Opcional. El cuidador las verá en el detalle de la visita."
        />

        <div className={styles.acciones}>
          <Button type="submit" fullWidth icon={<CalendarPlus size={22} aria-hidden />}>
            Programar visita
          </Button>
          <ButtonLink to={volver} variant="outline" fullWidth>
            Cancelar
          </ButtonLink>
        </div>
      </form>

      <SuccessOverlay
        open={ok !== null}
        message="Visita programada correctamente!"
        onDone={() => navigate(ok?.tab === 'proximas' ? `${volver}?tab=proximas` : volver, { replace: true })}
      />
    </Page>
  )
}
