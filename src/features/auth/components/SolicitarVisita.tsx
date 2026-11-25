/*
 * SolicitarVisita.tsx — Formulario público "Solicitar una visita" para personas externas (visitante / voluntario
 * ocasional): elige la organización, se identifica, indica a quién quiere visitar, cuándo y por qué. Al enviar
 * recibe un código de seguimiento que se muestra una sola vez.
 * Módulo: auth (Reglas de Negocio V2 §Usuario y §Visita · feedback de PM sobre LOGIN SCREEN · RF-06).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Componente independiente del store: recibe las organizaciones y la función que envía la solicitud, así el
 * mismo formulario sirve en el prototipo y en el modo conectado a la API pública.
 *  - Tres pasos: organización y contacto, tipo de visita, horario y confirmación.
 *  - Privacidad: no lista ni muestra perfiles de adultos mayores; quien autoriza confirma a quién corresponde.
 *  - No se guarda el código: vive solo en memoria mientras está en pantalla.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleCheck, Copy, ScanSearch, Send, ShieldCheck } from 'lucide-react'
import { Button, ButtonLink, Checkbox, SelectField, StepBar, TextareaField, TextField } from '@/components/ui'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import { useBorradorCompleto } from '@/lib/useBorrador'
import { Aviso } from './Piezas'
import {
  CAMPOS_SOLICITUD_PASO,
  hayErrores,
  SOLICITUD_INICIAL,
  TIPOS_ENTIDAD_VISITANTE,
  validarPasoVisita,
  validarPasoDestino,
  validarPasoVisitante,
  type DatosSolicitud,
  type ErroresSolicitud,
} from '../lib/solicitudVisita'
import { formatCedula, formatTelefono } from '../lib/validar'

export interface OrganizacionOpcion {
  id: string
  nombre: string
}

/** Lo mínimo que el formulario necesita saber del resultado de enviar (compatible con `Resultado` del dominio). */
export type ResultadoEnvio = { ok: true; valor: { codigo: string } } | { ok: false; error: string; errores?: Record<string, string | undefined> }

interface Props {
  /** Organizaciones que reciben solicitudes (nunca familias). */
  organizaciones: OrganizacionOpcion[]
  /** Envía la solicitud: en el prototipo, `crearSolicitudVisita` de domain/api/solicitudes. */
  enviar: (datos: DatosSolicitud, idempotencia?: string) => Promise<ResultadoEnvio>
  /** Permite mostrar el estado de un servicio deshabilitado. */
  disponible?: boolean
  /** Ruta de "Consultar mi solicitud". */
  rutaConsulta?: string
  soloMemoria?: boolean
  visitasInstitucionales?: boolean
}

const INICIAL = { paso: 1, ...SOLICITUD_INICIAL }
const TOTAL = 3
const NOMBRE_PASO = ['Organización y tus datos', 'Tipo de visita', 'Horario y confirmación']

/** Copia al portapapeles; si el navegador no lo permite usa un campo temporal. Devuelve si lo logró. */
async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const campo = document.createElement('textarea')
      campo.value = texto
      campo.setAttribute('readonly', '')
      campo.className = 'sr-only'
      document.body.appendChild(campo)
      campo.select()
      const ok = document.execCommand('copy')
      campo.remove()
      return ok
    } catch {
      return false
    }
  }
}

export function SolicitarVisita({ organizaciones, enviar, disponible = true, rutaConsulta = '/solicitud-visita', soloMemoria = false, visitasInstitucionales = true }: Props) {
  const enLinea = useEnLinea()
  const { valor: borrador, setValor: setD, reiniciar } = useBorradorCompleto('solicitud-visita', INICIAL, { soloMemoria })
  const d = visitasInstitucionales ? borrador : { ...borrador, tipoVisita: 'personal' as const }
  const [acepto, setAcepto] = useState(false)
  const [errores, setErrores] = useState<ErroresSolicitud>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null)
  const intentoEnvio = useRef<{ datos: string; clave: string } | undefined>(undefined)
  const hayOrganizaciones = organizaciones.length > 0
  const encabezadoPaso = useRef<HTMLParagraphElement>(null)
  const paso = Math.min(Math.max(d.paso, 1), TOTAL)
  const pasoAnterior = useRef(paso)

  // Al cambiar de pantalla el foco pasa al encabezado para anunciar el paso actual.
  // Se compara con el paso anterior (no con "primera vez") para no robar el foco al montar, ni en StrictMode.
  useEffect(() => {
    if (pasoAnterior.current === paso) return
    pasoAnterior.current = paso
    encabezadoPaso.current?.focus()
  }, [paso])

  const set = <K extends keyof DatosSolicitud>(campo: K, valor: DatosSolicitud[K]) => {
    setD((x) => ({ ...x, [campo]: valor }))
    setErrores((x) => ({ ...x, [campo]: undefined }))
    setGeneral(undefined)
  }
  const irA = (p: number) => {
    setErrores({})
    setGeneral(undefined)
    setD((x) => ({ ...x, paso: p }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (cargando || !hayOrganizaciones) return
    if (paso === 1) {
      const v = validarPasoVisitante(d)
      setErrores(v)
      if (!hayErrores(v)) irA(2)
      return
    }
    if (paso === 2) {
      const v = validarPasoDestino(d)
      setErrores(v)
      if (!hayErrores(v)) irA(3)
      return
    }
    const v = validarPasoVisita(d, acepto)
    setErrores(v)
    if (hayErrores(v)) return
    setCargando(true)
    try {
      const datosDelIntento = JSON.stringify(d)
      if (!intentoEnvio.current || intentoEnvio.current.datos !== datosDelIntento) {
        intentoEnvio.current = { datos: datosDelIntento, clave: crypto.randomUUID() }
      }
      const res = await enviar(d, intentoEnvio.current.clave)
      if (res.ok) {
        reiniciar()
        intentoEnvio.current = undefined
        setCodigo(res.valor.codigo)
        setCopiado(null)
        return
      }
      const errs = res.errores ?? {}
      const pasoConError = ([1, 2, 3] as const).find((p) => CAMPOS_SOLICITUD_PASO[p].some((c) => errs[c]))
      if (pasoConError && pasoConError !== paso) setD((x) => ({ ...x, paso: pasoConError }))
      setErrores(errs)
      setGeneral(hayErrores(errs) ? undefined : res.error)
    } catch {
      setGeneral('No pudimos enviar tu solicitud. Inténtalo de nuevo en unos segundos.')
    } finally {
      setCargando(false)
    }
  }

  const copiarCodigo = async () => {
    if (!codigo) return
    setCopiado((await copiar(codigo)) ? 'si' : 'no')
  }

  const nueva = () => {
    setCodigo(null)
    setCopiado(null)
    setAcepto(false)
    reiniciar()
  }

  const cabecera = (
    <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-balance text-xl font-bold leading-snug text-navy">Solicitar una visita</h2>
    </div>
  )

  if (!disponible) {
    return (
      <div className="flex min-w-0 flex-col gap-5 font-sans text-sm leading-relaxed">
        {cabecera}
        <Aviso tono="info">
          La solicitud de visitas en línea todavía no está disponible en esta versión. Mientras tanto, comunícate directamente con la organización que quieres visitar.
        </Aviso>
      </div>
    )
  }

  if (codigo) {
    return (
      <div className="flex min-w-0 flex-col gap-5 font-sans text-sm leading-relaxed">
        <div className="flex flex-col items-center gap-2 text-center" role="status">
          <CircleCheck size={36} strokeWidth={1.8} className="text-success-700" aria-hidden />
          <h2 className="text-balance text-xl font-bold leading-tight text-navy">Solicitud enviada</h2>
          <p className="text-pretty text-ink-2">Este es tu código de seguimiento. Con él consultas cómo va tu solicitud.</p>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-md border-2 border-navy bg-blue-100 px-4 py-5">
          <p className="select-all wrap-anywhere text-center font-mono text-2xl font-bold tracking-[0.08em] text-navy">
            {codigo}
          </p>
          <Button size="sm" variant="outline" onClick={copiarCodigo} icon={copiado === 'si' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}>
            {copiado === 'si' ? 'Código copiado' : 'Copiar código'}
          </Button>
          <p className="min-h-5 text-sm text-ink-2" role="status">
            {copiado === 'si' && 'Copiado al portapapeles.'}
            {copiado === 'no' && 'No pudimos copiarlo. Tócalo para seleccionarlo y cópialo a mano.'}
          </p>
        </div>

        <Aviso tono="warning">
          <strong>Guarda este código ahora.</strong> Solo se muestra esta vez y no podemos recuperarlo: sin él no podrás consultar tu solicitud.
        </Aviso>

        <div className="flex gap-3 rounded-md border border-line-soft bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-2">
          <ShieldCheck size={20} aria-hidden className="mt-0.5 flex-none text-blue" />
          <p>
            <strong className="text-ink">Una persona responsable de la organización debe autorizar tu solicitud.</strong> Hasta que lo haga, la visita no está
            confirmada. Desde el inicio del horario autorizado podrás consultar tu código y agregar observaciones y fotografías.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <ButtonLink size="sm" to={rutaConsulta} state={soloMemoria ? undefined : { codigo }} fullWidth icon={<ScanSearch size={18} aria-hidden />}>
            Consultar mi solicitud
          </ButtonLink>
          <Button size="sm" variant="ghost" fullWidth onClick={nueva}>
            Ya guardé mi código
          </Button>
        </div>
      </div>
    )
  }

  const hoy = todayISO()

  return (
    <form className="visita-formulario flex min-w-0 flex-col gap-4 font-sans text-sm leading-relaxed" onSubmit={submit} noValidate aria-busy={cargando || undefined}>
      {cabecera}
      <div className="flex flex-col gap-2">
        <StepBar step={paso} total={TOTAL} />
        <p ref={encabezadoPaso} tabIndex={-1} className="text-sm font-semibold text-ink-2 outline-none">
          Paso {paso} de {TOTAL} · {NOMBRE_PASO[paso - 1]}
        </p>
      </div>

      {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para enviar la solicitud. Lo que escribiste se conserva.</Aviso>}
      {!hayOrganizaciones && <Aviso tono="info">Por el momento no hay organizaciones disponibles para recibir solicitudes.</Aviso>}

      {paso === 1 && (
        <fieldset disabled={!hayOrganizaciones || cargando} className="visita-campos grid min-w-0 gap-4">
          <legend className="sr-only">Organización y tus datos</legend>
          <div className="visita-campo-ancho">
            <SelectField
              label="Organización que quieres visitar"
              placeholder={hayOrganizaciones ? 'Seleccionar' : 'No hay organizaciones disponibles'}
              options={organizaciones.map((o) => ({ value: o.id, label: o.nombre }))}
              value={d.orgId}
              error={errores.orgId}
              onChange={(e) => set('orgId', e.target.value)}
            />
          </div>
          <TextField label="Tu nombre" autoComplete="given-name" value={d.nombres} error={errores.nombres} onChange={(e) => set('nombres', e.target.value)} />
          <TextField label="Tus apellidos" autoComplete="family-name" value={d.apellidos} error={errores.apellidos} onChange={(e) => set('apellidos', e.target.value)} />
          <TextField
            label="Cédula"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000-0000000-0"
            maxLength={13}
            value={d.cedula}
            error={errores.cedula}
            onChange={(e) => set('cedula', formatCedula(e.target.value))}
          />
          <TextField
            label="Teléfono"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="000 000 0000"
            maxLength={12}
            value={d.telefono}
            error={errores.telefono}
            onChange={(e) => set('telefono', formatTelefono(e.target.value))}
          />
          <div className="visita-campo-ancho">
            <TextField
              label="Correo electrónico"
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ejemplo@correo.com"
              value={d.correo}
              error={errores.correo}
              onChange={(e) => set('correo', e.target.value)}
            />
          </div>
        </fieldset>
      )}

      {paso === 2 && (
        <fieldset disabled={cargando} className="visita-campos grid min-w-0 gap-4">
          <legend className="sr-only">Tu visita</legend>
          {visitasInstitucionales && <fieldset className="visita-tipo visita-campo-ancho grid gap-2">
            <legend className="mb-2 text-sm font-semibold text-ink">¿Qué tipo de visita quieres realizar?</legend>
            {[
              { value: 'personal' as const, titulo: 'Visita personal', detalle: 'Para visitar a una persona mayor.' },
              { value: 'institucional' as const, titulo: 'Visita de una institución o grupo', detalle: 'Para una actividad o aporte a la organización.' },
            ].map(({ value, titulo, detalle }) => <label key={value} className={'flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border p-3 ' + ((d.tipoVisita ?? 'personal') === value ? 'border-navy bg-blue-100/50' : 'border-line-soft bg-white')}>
              <input type="radio" name="tipoVisita" value={value} checked={(d.tipoVisita ?? 'personal') === value}
                className="mt-0.5 size-5 shrink-0 accent-navy" onChange={() => { set('tipoVisita', value); setErrores({}) }} />
              <span><strong className="block font-semibold text-navy">{titulo}</strong><span className="mt-0.5 block text-sm text-ink-2">{detalle}</span></span>
            </label>)}
          </fieldset>}
          {d.tipoVisita === 'institucional' ? <>
            <div className="visita-campo-ancho"><TextField label="Nombre de la institución o del grupo" maxLength={160}
              value={d.entidadVisitante ?? ''} error={errores.entidadVisitante} onChange={(e) => set('entidadVisitante', e.target.value)}
              hint="La persona del primer paso será el contacto responsable de esta visita." /></div>
            <div><SelectField label="Tipo de institución o grupo" placeholder="Selecciona el tipo"
              options={TIPOS_ENTIDAD_VISITANTE} value={d.tipoEntidad ?? ''} error={errores.tipoEntidad} onChange={(e) => set('tipoEntidad', e.target.value)} /></div>
          </> : <div className="visita-campo-ancho">
            <TextField
              label="¿A quién quieres visitar?"
              placeholder="Nombre de la persona"
              maxLength={120}
              value={d.personaAVisitar}
              error={errores.personaAVisitar}
              hint="La organización confirmará a qué persona corresponde."
              onChange={(e) => set('personaAVisitar', e.target.value)}
            />
          </div>}
          <div className={d.tipoVisita === 'institucional' ? undefined : 'visita-campo-ancho'}><TextField label="Cantidad de visitantes" type="number" inputMode="numeric" min={1} step={1}
            value={d.cantidadVisitantes ?? '1'} error={errores.cantidadVisitantes} onChange={(e) => set('cantidadVisitantes', e.target.value)}
            hint="Incluye al contacto responsable." /></div>
          {d.tipoVisita === 'institucional' && <div className="visita-campo-ancho"><TextareaField
            label="Actividad o aporte previsto (opcional)" rows={2} maxLength={300} value={d.aportePrevisto ?? ''}
            placeholder="Actividad, acompañamiento o entrega prevista."
            error={errores.aportePrevisto} onChange={(e) => set('aportePrevisto', e.target.value)} /></div>}
        </fieldset>
      )}

      {paso === 3 && (
        <fieldset disabled={cargando} className="visita-campos grid min-w-0 gap-4">
          <legend className="sr-only">Horario y confirmación</legend>
          <TextField
            label="Fecha propuesta"
            type="date"
            min={hoy}
            value={d.fechaPropuesta}
            error={errores.fechaPropuesta}
            onChange={(e) => set('fechaPropuesta', e.target.value)}
          />
          <TextField label="Hora propuesta" type="time" value={d.horaPropuesta} error={errores.horaPropuesta} onChange={(e) => set('horaPropuesta', e.target.value)} required />
          <TextField label="Hora de fin propuesta" type="time" value={d.horaFinPropuesta ?? ''} error={errores.horaFinPropuesta} onChange={(e) => set('horaFinPropuesta', e.target.value)} required />
          <div className="visita-campo-ancho">
            <TextareaField
              label="Motivo de la visita"
              maxLength={300}
              rows={2}
              placeholder="Por ejemplo: acompañar un rato y conversar."
              value={d.motivo}
              error={errores.motivo}
              hint={`${d.motivo.length}/300`}
              onChange={(e) => set('motivo', e.target.value)}
            />
          </div>
          <div className="visita-campo-ancho">
            <Checkbox
              checked={acepto}
              error={errores.acepto}
              className="items-start py-1 leading-relaxed [&_input]:mt-0.5"
              onChange={(e) => {
                setAcepto(e.target.checked)
                setErrores((x) => ({ ...x, acepto: undefined }))
              }}
              label={
                <>
                  He leído la <Link to="/privacidad" target="_blank" rel="noreferrer">Política de Privacidad</Link> y acepto que CuidaRed use mis datos para gestionar esta solicitud.
                </>
              }
            />
          </div>
        </fieldset>
      )}

      {general && <Aviso tono="error">{general}</Aviso>}

      <div className="visita-acciones flex flex-col-reverse gap-2 border-t border-line-soft pt-4">
        {paso > 1 && (
          <Button size="sm" variant="outline" disabled={cargando} onClick={() => irA(paso - 1)} icon={<ArrowLeft size={18} aria-hidden />}>
            Anterior
          </Button>
        )}
        <Button size="sm" type="submit" loading={cargando} disabled={!enLinea || !hayOrganizaciones}
          icon={paso === TOTAL ? <Send size={18} aria-hidden /> : <ArrowRight size={18} aria-hidden />}>
          {paso === TOTAL ? (cargando ? 'Enviando…' : 'Enviar solicitud') : 'Siguiente'}
        </Button>
      </div>
    </form>
  )
}
