/*
 * AdultoForm.tsx — Formulario de perfil del adulto mayor en tres pasos (Registrar CU-02 · Editar CU-03).
 *   Paso 1 · Identificación: nombres, apellidos, cédula, teléfono, fecha de nacimiento y sexo (Envejeciente).
 *   Paso 2 · Ubicación y contacto: provincia → municipio (Municipio_Cod), sector o barrio y dirección
 *            (Env_Direccion), y el contacto de emergencia principal (Contacto_emergencia: nombres, apellidos,
 *            parentesco, teléfono). Los demás contactos se gestionan en el perfil.
 *   Paso 3 · Condición y riesgo: autonomía, condición general, nivel de riesgo social + motivo (Env_Riesgo)
 *            y consentimiento informado.
 * RF-01 · RF-06 (≤ 5 campos de texto libre por pantalla, listas, casillas y píldoras, objetivos de 48 px,
 * un solo desplazamiento por paso a 360×640). Valida por paso y al guardar, muestra el mensaje junto a cada
 * campo y conserva lo escrito (useBorrador).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { WifiOff } from 'lucide-react'
import { Button, Checkbox, CheckboxGroup, ChoicePills, HelpTip, SelectField, StepBar, TextField, useToast } from '@/components/ui'
import { DATOS_ADULTO_VACIOS, PARENTESCOS, validarAdulto, type DatosAdulto, type Resultado } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { AUTONOMIAS, CONDICIONES } from '@/domain/catalogos'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { useBorrador } from '@/lib/useBorrador'
import { maskCedula, maskTelefono, opcionesParentesco } from '../lib/formato'
import { sectoresEnUso } from '../lib/ubicacion'
import { NotaInfo } from './Piezas'
import { RiesgoSelector } from './RiesgoSelector'

type Campo = keyof DatosAdulto
type Errores = Partial<Record<string, string | undefined>>
type Paso = 1 | 2 | 3

const PASOS: Record<Paso, Campo[]> = {
  1: ['nombre', 'apellido', 'cedula', 'telefono', 'fechaNacimiento', 'sexo'],
  2: ['provinciaCod', 'municipioCod', 'zona', 'direccion', 'contactoNombres', 'contactoApellidos', 'contactoParentesco', 'contactoTelefono'],
  3: ['autonomia', 'condiciones', 'notaCondicion', 'riesgo', 'motivoRiesgo', 'consentimiento'],
}
const TITULOS: Record<Paso, string> = { 1: 'Identificación', 2: 'Ubicación y contacto', 3: 'Condición y riesgo' }
const TOTAL = 3
const pasoDe = (c: string): Paso => (PASOS[1].includes(c as Campo) ? 1 : PASOS[2].includes(c as Campo) ? 2 : 3)

const AYUDA_RIESGO = (
  <>
    <b>Bajo:</b> situación estable y con red de apoyo. <b>Medio:</b> vulnerabilidad moderada (vive solo/a, ingresos inestables o salud que
    requiere seguimiento). <b>Alto:</b> vulnerabilidad alta (dependencia, sin apoyo familiar, vivienda precaria); genera automáticamente una
    alerta de caso prioritario. Puedes recalcularlo después con la <b>Evaluación de riesgo</b> del perfil.
  </>
)

const AYUDA_CONSENTIMIENTO =
  'Ley 172-13 de protección de datos personales: antes de registrar a una persona hay que informarle para qué se usarán sus datos y obtener su autorización (o la de su representante si no puede darla). Solo se guardan los datos necesarios para el seguimiento.'

export function AdultoForm({
  claveBorrador,
  inicial = DATOS_ADULTO_VACIOS,
  idActual,
  titulo,
  intro,
  enviarTexto,
  onGuardar,
  onExito,
  onCancel,
}: {
  claveBorrador: string
  inicial?: DatosAdulto
  /** Adulto que se edita (se excluye de la comprobación de cédula duplicada). */
  idActual?: string
  titulo: string
  intro?: string
  enviarTexto: string
  onGuardar: (d: DatosAdulto) => Resultado<Adulto>
  onExito: (a: Adulto, offline?: boolean) => void
  onCancel: () => void
}) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const adultos = useDB((s) => s.adultos)
  const catalogos = useDB((s) => s.catalogos)
  const [d, setD, descartar] = useBorrador<DatosAdulto>(claveBorrador, inicial)
  const [paso, setPaso] = useState<Paso>(1)
  const [intentado, setIntentado] = useState<Record<Paso, boolean>>({ 1: false, 2: false, 3: false })
  const [servidor, setServidor] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const listaSectores = useId()

  const municipios = useMemo(() => catalogos.municipios.filter((m) => m.provinciaCod === d.provinciaCod), [catalogos.municipios, d.provinciaCod])
  // Sugerencias de sector: los ya registrados en el municipio elegido (o en toda la organización).
  const sectores = useMemo(() => {
    const propios = adultos.filter((a) => a.orgId === user.orgId)
    const delMunicipio = sectoresEnUso(propios, d.municipioCod || undefined)
    return delMunicipio.length > 0 ? delMunicipio : sectoresEnUso(propios)
  }, [adultos, user.orgId, d.municipioCod])
  const locales = useMemo(() => validarAdulto(d, adultos, idActual, user.orgId, catalogos.municipios) as Errores, [d, adultos, idActual, user.orgId, catalogos.municipios])

  const err = (c: Campo) => servidor[c] ?? (intentado[pasoDe(c)] ? locales[c] : undefined)
  const hayErrorEn = (p: Paso) => PASOS[p].some((c) => locales[c])

  const set = <K extends Campo>(campo: K, valor: DatosAdulto[K]) => {
    setD((x) => ({ ...x, [campo]: valor }))
    if (servidor[campo]) setServidor((s) => ({ ...s, [campo]: undefined }))
  }

  const cambiarProvincia = (provinciaCod: string) => {
    const deProvincia = catalogos.municipios.filter((m) => m.provinciaCod === provinciaCod)
    setD((x) => ({
      ...x,
      provinciaCod,
      // Si la provincia tiene un solo municipio (p. ej. Distrito Nacional) se selecciona solo.
      municipioCod: deProvincia.some((m) => m.cod === x.municipioCod) ? x.municipioCod : deProvincia.length === 1 ? deProvincia[0]!.cod : '',
    }))
    setServidor((s) => ({ ...s, provinciaCod: undefined, municipioCod: undefined }))
  }

  const enfocarError = () =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: false }))

  const irA = (p: Paso) => {
    setPaso(p)
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }

  const avanzar = () => {
    setIntentado((x) => ({ ...x, [paso]: true }))
    if (hayErrorEn(paso)) {
      enfocarError()
      return
    }
    irA((paso + 1) as Paso)
  }

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    if (paso < TOTAL) {
      avanzar()
      return
    }
    setIntentado({ 1: true, 2: true, 3: true })
    const conError = ([1, 2, 3] as Paso[]).find((p) => hayErrorEn(p))
    if (conError) {
      if (conError !== paso) setPaso(conError)
      enfocarError()
      return
    }
    setGuardando(true)
    const r = onGuardar(d)
    setGuardando(false)
    if (!r.ok) {
      setServidor(r.errores ?? {})
      toast(r.error, 'error')
      const primero = Object.keys(r.errores ?? {}).find((c) => r.errores?.[c])
      if (primero) setPaso(pasoDe(primero))
      enfocarError()
      return
    }
    descartar()
    onExito(r.valor, r.offline)
  }

  const cancelar = () => {
    descartar()
    onCancel()
  }

  const tel = (campo: 'telefono' | 'contactoTelefono', label: string, opcional = false) => (
    <TextField
      label={label}
      required={!opcional}
      type="tel"
      inputMode="numeric"
      autoComplete="off"
      placeholder="809 000 0000"
      value={d[campo]}
      onChange={(e) => set(campo, maskTelefono(e.target.value))}
      error={err(campo)}
      hint={opcional ? 'Opcional' : undefined}
    />
  )

  return (
    <form ref={formRef} className="flex flex-col gap-4 w-full max-w-form mx-auto" onSubmit={guardar} noValidate>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-ink">{titulo}</h2>
        {intro && paso === 1 && <p className="text-sm text-ink-2">{intro}</p>}
        <p className="flex items-center justify-between gap-3 text-sm font-semibold text-navy" aria-live="polite">
          <span>
            Paso {paso} de {TOTAL} · {TITULOS[paso]}
          </span>
          <span className="text-muted font-normal">* Obligatorio</span>
        </p>
        <StepBar step={paso} total={TOTAL} />
      </div>

      {paso === 1 && (
        <fieldset className="grid grid-cols-2 gap-x-3 gap-y-4 border-0 p-0 m-0 min-w-0">
          <legend className="sr-only">Identificación</legend>
          <TextField label="Nombres" required autoComplete="off" value={d.nombre} onChange={(e) => set('nombre', e.target.value)} error={err('nombre')} maxLength={60} />
          <TextField label="Apellidos" required autoComplete="off" value={d.apellido} onChange={(e) => set('apellido', e.target.value)} error={err('apellido')} maxLength={60} />
          <TextField
            label="Cédula"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="000-0000000-0"
            value={d.cedula}
            onChange={(e) => set('cedula', maskCedula(e.target.value))}
            error={err('cedula')}
          />
          {tel('telefono', 'Teléfono', true)}
          <div className="col-span-2 sm:col-span-1">
            <TextField
              label="Fecha de nacimiento"
              required
              type="date"
              max={todayISO()}
              min="1900-01-01"
              value={d.fechaNacimiento}
              onChange={(e) => set('fechaNacimiento', e.target.value)}
              error={err('fechaNacimiento')}
              help="CuidaRed acompaña a personas de 60 años o más (Ley 352-98). Toca el campo para abrir el calendario."
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <ChoicePills
              label="Sexo *"
              value={d.sexo}
              onChange={(s) => set('sexo', s)}
              error={err('sexo')}
              options={[
                { value: 'Femenino', label: 'Femenino' },
                { value: 'Masculino', label: 'Masculino' },
              ]}
            />
          </div>
        </fieldset>
      )}

      {paso === 2 && (
        <>
          <fieldset className="grid grid-cols-2 gap-x-3 gap-y-3 border-0 p-0 m-0 min-w-0">
            <legend className="text-base font-bold text-navy mb-2">Ubicación</legend>
            <SelectField
              label="Provincia"
              required
              placeholder="Seleccionar"
              value={d.provinciaCod}
              onChange={(e) => cambiarProvincia(e.target.value)}
              error={err('provinciaCod')}
              options={catalogos.provincias.map((p) => ({ value: p.cod, label: p.nombre }))}
            />
            <SelectField
              label="Municipio"
              required
              placeholder={d.provinciaCod ? 'Seleccionar' : 'Elige la provincia'}
              disabled={!d.provinciaCod}
              value={d.municipioCod}
              onChange={(e) => set('municipioCod', e.target.value)}
              error={err('municipioCod')}
              options={municipios.map((m) => ({ value: m.cod, label: m.nombre }))}
            />
            <div className="col-span-2">
              <TextField
                label="Sector o barrio"
                required
                autoComplete="off"
                list={listaSectores}
                placeholder="Ej.: Renacimiento"
                value={d.zona}
                onChange={(e) => set('zona', e.target.value)}
                error={err('zona')}
                maxLength={60}
                help="Se usa para organizar las visitas y filtrar los reportes por sector. Al escribir verás los sectores ya registrados: elige uno para no duplicarlos con otra escritura."
              />
              <datalist id={listaSectores}>
                {sectores.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="col-span-2">
              <TextField
                label="Dirección"
                autoComplete="off"
                placeholder="Calle, número y referencias"
                value={d.direccion}
                onChange={(e) => set('direccion', e.target.value)}
                error={err('direccion')}
                hint="Opcional · ayuda al voluntario a llegar"
                maxLength={150}
              />
            </div>
          </fieldset>
          <fieldset className="grid grid-cols-2 gap-x-3 gap-y-3 border-0 p-0 m-0 min-w-0">
            <legend className="flex items-center gap-1 text-base font-bold text-navy mb-2">
              Contacto de emergencia principal
              <HelpTip label="Ayuda: contacto de emergencia">
                Persona a quien llamar si el adulto mayor necesita ayuda. Desde el perfil puedes agregar más contactos y elegir cuál es el principal.
              </HelpTip>
            </legend>
            <TextField label="Nombres" required autoComplete="off" value={d.contactoNombres} onChange={(e) => set('contactoNombres', e.target.value)} error={err('contactoNombres')} maxLength={60} />
            <TextField label="Apellidos" required autoComplete="off" value={d.contactoApellidos} onChange={(e) => set('contactoApellidos', e.target.value)} error={err('contactoApellidos')} maxLength={60} />
            <SelectField
              label="Parentesco"
              required
              placeholder="Seleccionar"
              value={d.contactoParentesco}
              onChange={(e) => set('contactoParentesco', e.target.value)}
              error={err('contactoParentesco')}
              options={opcionesParentesco(PARENTESCOS, d.contactoParentesco)}
            />
            {tel('contactoTelefono', 'Teléfono')}
          </fieldset>
        </>
      )}

      {paso === 3 && (
        <fieldset className="flex flex-col gap-3 border-0 p-0 m-0 min-w-0">
          <legend className="sr-only">Condición y riesgo</legend>
          <SelectField
            label="Grado de autonomía"
            required
            placeholder="Seleccionar"
            value={d.autonomia}
            onChange={(e) => set('autonomia', e.target.value as DatosAdulto['autonomia'])}
            error={err('autonomia')}
            options={AUTONOMIAS}
            help="Capacidad para realizar solo/a las actividades de la vida diaria: comer, asearse, vestirse y desplazarse."
          />
          <div className="[&_fieldset>div.grid]:grid-cols-2">
            <CheckboxGroup
              label="Condición general"
              options={CONDICIONES}
              value={d.condiciones}
              onChange={(v) => set('condiciones', v)}
              error={err('condiciones')}
              help="Marca solo las situaciones que apliquen. Son categorías generales, no diagnósticos: no registres información clínica detallada (Ley 42-01)."
            />
          </div>
          <RiesgoSelector value={d.riesgo} onChange={(r) => set('riesgo', r)} error={err('riesgo')} help={AYUDA_RIESGO} />
          <TextField
            label="Motivo del nivel de riesgo"
            autoComplete="off"
            placeholder="Ej.: Vive sola y no tiene ingresos fijos"
            value={d.motivoRiesgo}
            onChange={(e) => set('motivoRiesgo', e.target.value)}
            error={err('motivoRiesgo')}
            maxLength={200}
            hint={idActual ? 'Opcional · se guarda en el historial solo si cambias el nivel' : 'Opcional'}
            help="Queda en el historial de riesgos del perfil, con la fecha y tu nombre. Explica en pocas palabras por qué asignas este nivel."
          />
          <fieldset className="flex flex-col gap-1 border-0 p-0 m-0 min-w-0" aria-describedby={err('consentimiento') ? 'consent-err' : undefined}>
            <legend className="flex items-center gap-1 text-base font-semibold text-ink">
              Consentimiento informado<span aria-hidden> *</span>
              <span className="sr-only"> (obligatorio)</span>
              <HelpTip label="Ayuda: consentimiento informado">{AYUDA_CONSENTIMIENTO}</HelpTip>
            </legend>
            <Checkbox
              label="Se informó y se obtuvo la autorización para registrar y usar estos datos."
              checked={d.consentimiento}
              aria-invalid={err('consentimiento') ? true : undefined}
              onChange={(e) => set('consentimiento', e.target.checked)}
            />
            {err('consentimiento') && (
              <p className="text-danger text-sm" role="alert" id="consent-err">
                {err('consentimiento')}
              </p>
            )}
            <ChoicePills
              label="Otorgado por"
              value={d.consentimientoPor}
              onChange={(v) => set('consentimientoPor', v)}
              options={[
                { value: 'adulto', label: 'Adulto mayor' },
                { value: 'representante', label: 'Representante' },
              ]}
            />
          </fieldset>
        </fieldset>
      )}

      {!enLinea && (
        <NotaInfo tono="aviso">
          <span className="inline-flex items-center gap-1 font-semibold">
            <WifiOff size={16} aria-hidden /> Sin conexión.
          </span>{' '}
          Registrar o editar perfiles necesita internet. Lo que escribiste se conserva en este dispositivo: podrás guardarlo al recuperar la conexión.
        </NotaInfo>
      )}

      <div className="grid grid-cols-2 gap-3">
        {paso === 1 ? (
          <Button variant="light" onClick={cancelar}>
            Cancelar
          </Button>
        ) : (
          <Button variant="light" onClick={() => irA((paso - 1) as Paso)}>
            Atrás
          </Button>
        )}
        {paso < TOTAL ? (
          <Button type="submit">Siguiente</Button>
        ) : (
          <Button type="submit" disabled={!enLinea} loading={guardando} title={enLinea ? undefined : 'Necesitas conexión a internet para guardar'}>
            {enviarTexto}
          </Button>
        )}
      </div>
    </form>
  )
}
