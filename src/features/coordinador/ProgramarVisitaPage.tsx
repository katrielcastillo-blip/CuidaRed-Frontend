/*
 * ProgramarVisitaPage.tsx — Programar una visita y asignarla a un voluntario responsable (coordinador).
 * Captura el motivo de la visita (Visit_razon: lista predefinida + "Otra"), adulto (DetalleVisita),
 * responsable (RegistroVisita.User_Id), fecha y hora; quien programa queda como Autorizada_por_user_Id.
 * Usa el servicio programarVisita (valida, comprueba permiso "visitas:programar" y alcance, audita).
 * Requiere conexión: sin ella el botón se deshabilita y se explica por qué. El borrador se conserva
 * si la pantalla se cierra (SRS §8.2.2.1.22). RF-06 (formulario móvil) · RF-09 · CU-05.
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarPlus, WifiOff } from 'lucide-react'
import { Button, ButtonLink, IconTile, RiesgoBadge, SelectField, SuccessOverlay, TextareaField, TextField, useToast } from '@/components/ui'
import { programarVisita } from '@/domain/api'
import { nombreCompleto } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, pad, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { voluntariosDe } from '@/domain/relaciones'
import { Page, useShell } from '@/layouts/AppShell'
import { useBorrador } from '@/lib/useBorrador'
import { horaPautada12, RAZON_OTRA, RAZONES_VISITA, useOrgData } from './lib/datos'

interface Form {
  adultoId: string
  responsableId: string
  /** Motivo elegido de la lista (o "Otra"). */
  razon: string
  /** Motivo escrito cuando se elige "Otra". */
  razonOtra: string
  fecha: string
  hora: string
  notas: string
}
type Campo = 'adulto' | 'responsable' | 'razon' | 'fecha' | 'hora' | 'notas'
type Errores = Partial<Record<Campo, string>>

const MAX_NOTAS = 300

const ahoraHHMM = () => {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ProgramarVisitaPage() {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [params] = useSearchParams()
  const { user, adultos, adultoPorId, voluntarios, visitas, vinculos } = useOrgData()

  const adultosActivos = useMemo(
    () => adultos.filter((a) => a.estado === 'activo').sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es')),
    [adultos],
  )
  const voluntariosActivos = useMemo(() => voluntarios.filter((v) => v.estado === 'activo'), [voluntarios])

  /** Primer voluntario activo con vínculo "voluntario_asignado" con el adulto. */
  const asignadoDe = (adultoId: string) => {
    const ids = voluntariosDe(vinculos, adultoId)
    return voluntariosActivos.find((v) => ids.includes(v.id))?.id
  }

  const pre = params.get('adulto') ?? ''
  const [form, setForm, descartar] = useBorrador<Form>(`programar-visita:${user.id}`, {
    adultoId: '',
    responsableId: '',
    razon: '',
    razonOtra: '',
    fecha: todayISO(),
    hora: '',
    notas: '',
  })
  // Adulto indicado en la URL (?adulto=) tiene prioridad sobre el borrador.
  const [aplicado, setAplicado] = useState(false)
  if (!aplicado && pre && adultoPorId.has(pre) && form.adultoId !== pre) {
    setAplicado(true)
    setForm((f) => ({ ...f, adultoId: pre, responsableId: asignadoDe(pre) ?? f.responsableId }))
  }

  const [errores, setErrores] = useState<Errores>({})
  const [ok, setOk] = useState<{ tab: 'hoy' | 'proximas'; detalle: string } | null>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K], campo: Campo) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const adulto = adultoPorId.get(form.adultoId)

  const onAdulto = (adultoId: string) => {
    setForm((f) => ({ ...f, adultoId, responsableId: f.responsableId || (asignadoDe(adultoId) ?? '') }))
    setErrores((e) => ({ ...e, adulto: undefined }))
  }

  // Los voluntarios ya asignados al adulto aparecen primero.
  const opcionesResponsable = useMemo(() => {
    const ids = new Set(adulto ? voluntariosDe(vinculos, adulto.id) : [])
    const orden = [...voluntariosActivos].sort(
      (a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)) || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'),
    )
    return orden.map((c) => ({ value: c.id, label: ids.has(c.id) ? `${nombreCompleto(c)} · asignado` : nombreCompleto(c) }))
  }, [voluntariosActivos, adulto, vinculos])

  /** Reglas de agenda que el servicio no cubre: fecha y hora futuras y sin choque de horario. */
  const validarAgenda = (): Errores => {
    const e: Errores = {}
    if (form.fecha && form.fecha < todayISO()) e.fecha = 'La fecha no puede ser anterior a hoy.'
    if (form.hora && form.fecha === todayISO() && form.hora < ahoraHHMM()) e.hora = 'Esa hora ya pasó. Elige una hora posterior.'
    else if (
      form.hora &&
      form.responsableId &&
      visitas.some((v) => v.cuidadorId === form.responsableId && v.fecha === form.fecha && v.horaPautada === form.hora && v.estado !== 'cancelada')
    )
      e.hora = 'Ese voluntario ya tiene una visita a esa hora.'
    return e
  }

  const razonFinal = (form.razon === RAZON_OTRA ? form.razonOtra : form.razon).trim()

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!enLinea) return
    // Reglas de agenda primero (no se guarda una visita en el pasado ni con choque de horario).
    const agenda = validarAgenda()
    if (Object.values(agenda).some(Boolean)) {
      setErrores({
        adulto: form.adultoId ? undefined : 'Selecciona un adulto mayor.',
        responsable: form.responsableId ? undefined : 'Selecciona el responsable.',
        razon: razonFinal ? undefined : 'Indica el motivo de la visita.',
        ...agenda,
      })
      toast('Revisa los campos marcados.', 'error')
      return
    }
    const r = programarVisita(user, {
      adultoId: form.adultoId,
      responsableId: form.responsableId,
      razon: razonFinal,
      fecha: form.fecha,
      hora: form.hora,
      notas: form.notas,
    })
    if (!r.ok) {
      setErrores((r.errores as Errores | undefined) ?? {})
      toast(r.error, 'error')
      return
    }
    descartar()
    setOk({
      tab: form.fecha === todayISO() ? 'hoy' : 'proximas',
      detalle: `${razonFinal} · ${adulto ? nombreCompleto(adulto) : 'Visita'} · ${fechaCorta(form.fecha)} · ${horaPautada12(form.hora)}`,
    })
  }

  const volver = `${base}/visitas`

  if (!puede(user, 'visitas:programar')) {
    return (
      <Page title="Programar visita" back={volver}>
        <p className="text-muted">No tienes permiso para programar visitas.</p>
      </Page>
    )
  }

  return (
    <Page title="Programar visita" back={volver}>
      <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
        {!enLinea && (
          <div role="status" className="flex items-start gap-3 p-4 rounded-sm bg-warning-100 border border-warning text-sm text-ink">
            <WifiOff size={20} className="flex-none mt-0.5 text-warning-700" aria-hidden />
            <p>
              <strong>Sin conexión.</strong> Programar una visita necesita internet porque se asigna al voluntario en el servidor central. Tus datos
              se conservan: podrás guardarlos al recuperar la conexión.
            </p>
          </div>
        )}

        {adulto && (
          <div className="flex items-center gap-4 p-4 rounded-md bg-blue-100 border border-blue">
            <IconTile size={56} />
            <div className="flex flex-col gap-1 min-w-0">
              <strong className="text-lg text-ink wrap-anywhere">{nombreCompleto(adulto)}</strong>
              <div className="flex flex-wrap items-center gap-2">
                <RiesgoBadge riesgo={adulto.riesgo} />
                <span className="text-sm text-muted">{adulto.zona}</span>
              </div>
              <Link to={`${base}/adultos/${adulto.id}`} className="inline-flex items-center gap-1 min-h-12 -my-2 text-sm font-semibold text-navy hover:underline">
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
          error={errores.adulto}
        />

        <SelectField
          label="Voluntario responsable"
          required
          placeholder="Selecciona un voluntario"
          value={form.responsableId}
          onChange={(e) => set('responsableId', e.target.value, 'responsable')}
          options={opcionesResponsable}
          error={errores.responsable}
          help="Persona que realizará la visita. Si aún no tiene asignado a este adulto, se le asignará automáticamente para que lo vea en su lista."
          hint={adulto && !asignadoDe(adulto.id) ? 'Este adulto aún no tiene voluntario asignado.' : undefined}
        />

        <SelectField
          label="Motivo de la visita"
          required
          placeholder="Selecciona el motivo"
          value={form.razon}
          onChange={(e) => set('razon', e.target.value, 'razon')}
          options={[...RAZONES_VISITA, RAZON_OTRA]}
          error={form.razon === RAZON_OTRA ? undefined : errores.razon}
          help="Razón principal de la visita. Se guarda en el registro de la visita y la ven el voluntario y la familia del adulto."
        />
        {form.razon === RAZON_OTRA && (
          <TextField
            label="Escribe el motivo"
            required
            maxLength={120}
            placeholder="Ej.: Acompañar la entrega de una silla de ruedas"
            value={form.razonOtra}
            onChange={(e) => set('razonOtra', e.target.value, 'razon')}
            error={errores.razon}
            hint={`${form.razonOtra.length}/120`}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Fecha"
            type="date"
            required
            min={todayISO()}
            value={form.fecha}
            onChange={(e) => set('fecha', e.target.value, 'fecha')}
            error={errores.fecha}
          />
          <TextField label="Hora" type="time" required value={form.hora} onChange={(e) => set('hora', e.target.value, 'hora')} error={errores.hora} />
        </div>

        <TextareaField
          label="Notas para el voluntario"
          placeholder="Instrucciones previas: verificar estado general, llevar tensiómetro…"
          maxLength={MAX_NOTAS}
          value={form.notas}
          onChange={(e) => set('notas', e.target.value, 'notas')}
          error={errores.notas}
          hint={`Opcional · ${form.notas.length}/${MAX_NOTAS}. El voluntario las verá en el detalle de la visita.`}
        />

        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button type="submit" fullWidth disabled={!enLinea} icon={<CalendarPlus size={22} aria-hidden />}>
            Programar visita
          </Button>
          <ButtonLink to={volver} variant="outline" fullWidth>
            Cancelar
          </ButtonLink>
        </div>
        {!enLinea && <p className="-mt-2 text-sm text-muted text-center">Botón deshabilitado: necesitas conexión a internet.</p>}
      </form>

      <SuccessOverlay
        open={ok !== null}
        message="¡Visita programada correctamente!"
        detail={ok?.detalle}
        onDone={() => navigate(ok?.tab === 'proximas' ? `${volver}?tab=proximas` : volver, { replace: true })}
      />
    </Page>
  )
}
