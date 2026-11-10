/*
 * SolicitarVisita.tsx — Formulario público "Solicitar una visita" para personas externas (visitante / voluntario
 * ocasional): elige la organización, se identifica, indica a quién quiere visitar, cuándo y por qué. Al enviar
 * recibe un código de seguimiento que se muestra una sola vez.
 * Módulo: auth (Reglas de Negocio V2 §Usuario y §Visita · feedback de PM sobre LOGIN SCREEN · RF-06).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Componente independiente del store: recibe las organizaciones y la función que envía la solicitud, así el
 * mismo formulario sirve en el prototipo (crearSolicitudVisita) y en el modo conectado, donde la solicitud
 * todavía no tiene API (se muestra con `disponible={false}`).
 *  - Dos pantallas con ≤ 5 campos de texto libre cada una: 1) organización y datos del visitante,
 *    2) a quién visita, fecha, hora, motivo y consentimiento.
 *  - Privacidad: no lista ni muestra perfiles de adultos mayores; quien autoriza confirma a quién corresponde.
 *  - No se guarda el código: vive solo en memoria mientras está en pantalla.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, CircleCheck, Copy, HandHeart, ShieldCheck } from 'lucide-react'
import { Button, ButtonLink, Checkbox, SelectField, StepBar, TextareaField, TextField } from '@/components/ui'
import { useEnLinea } from '@/domain/conectividad'
import { todayISO } from '@/domain/dates'
import { useBorrador } from '@/lib/useBorrador'
import { Aviso } from './Piezas'
import {
  CAMPOS_SOLICITUD_PASO,
  hayErrores,
  SOLICITUD_INICIAL,
  validarPasoVisita,
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
  enviar: (datos: DatosSolicitud) => Promise<ResultadoEnvio>
  /** false si el servicio todavía no existe (modo conectado): se muestra un aviso en lugar del formulario. */
  disponible?: boolean
  /** Ruta de "Consultar mi solicitud". */
  rutaConsulta?: string
}

const INICIAL = { paso: 1, ...SOLICITUD_INICIAL }
const TOTAL = 2
const NOMBRE_PASO = ['Organización y tus datos', 'Tu visita']

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

export function SolicitarVisita({ organizaciones, enviar, disponible = true, rutaConsulta = '/solicitud-visita' }: Props) {
  const enLinea = useEnLinea()
  const [d, setD, descartar] = useBorrador('solicitud-visita', INICIAL)
  const [acepto, setAcepto] = useState(false)
  const [errores, setErrores] = useState<ErroresSolicitud>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)
  const [codigo, setCodigo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null)
  const encabezadoPaso = useRef<HTMLParagraphElement>(null)
  const paso = Math.min(Math.max(d.paso, 1), TOTAL)
  const pasoAnterior = useRef(paso)

  // Al cambiar de pantalla el foco pasa al encabezado del paso (se anuncia "Paso 2 de 2 · Tu visita").
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
    if (cargando) return
    if (paso === 1) {
      const v = validarPasoVisitante(d)
      setErrores(v)
      if (!hayErrores(v)) irA(2)
      return
    }
    const v = validarPasoVisita(d, acepto)
    setErrores(v)
    if (hayErrores(v)) return
    setCargando(true)
    try {
      const res = await enviar(d)
      if (res.ok) {
        descartar()
        setCodigo(res.valor.codigo)
        setCopiado(null)
        return
      }
      const errs = res.errores ?? {}
      const pasoConError = ([1, 2] as const).find((p) => CAMPOS_SOLICITUD_PASO[p].some((c) => errs[c]))
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
    setD(INICIAL)
  }

  const cabecera = (
    <div className="flex items-start gap-4">
      <span className="grid size-14 flex-none place-items-center rounded-md bg-teal-100 text-success-700" aria-hidden>
        <HandHeart size={28} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-balance text-2xl font-bold leading-tight text-navy">Solicitar una visita</h2>
        <p className="text-pretty text-ink-2">
          ¿Quieres visitar a un adulto mayor? No necesitas una cuenta. Pide la visita a su organización y una persona responsable la revisará.
        </p>
      </div>
    </div>
  )

  if (!disponible) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <Aviso tono="info">
          La solicitud de visitas en línea todavía no está disponible en esta versión. Mientras tanto, comunícate directamente con la organización que quieres visitar.
        </Aviso>
      </div>
    )
  }

  if (codigo) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center" role="status">
          <CircleCheck size={48} strokeWidth={1.8} className="text-success-700" aria-hidden />
          <h2 className="text-balance text-2xl font-bold leading-tight text-navy">Solicitud enviada</h2>
          <p className="text-pretty text-ink-2">Este es tu código de seguimiento. Con él consultas cómo va tu solicitud.</p>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-md border-2 border-navy bg-blue-100 px-4 py-5">
          <p className="select-all wrap-anywhere text-center font-mono text-3xl font-bold tracking-[0.12em] text-navy">
            {codigo}
          </p>
          <Button variant="outline" onClick={copiarCodigo} icon={copiado === 'si' ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}>
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
            confirmada. Cuando consultes con tu código verás si fue autorizada o no y, el día de la visita, podrás dejar tu observación.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <ButtonLink to={rutaConsulta} state={{ codigo }} fullWidth>
            Consultar mi solicitud
          </ButtonLink>
          <Button variant="ghost" fullWidth onClick={nueva}>
            Ya guardé mi código
          </Button>
        </div>
      </div>
    )
  }

  const hoy = todayISO()

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate aria-busy={cargando || undefined}>
      {cabecera}
      <div className="flex flex-col gap-2">
        <StepBar step={paso} total={TOTAL} />
        <p ref={encabezadoPaso} tabIndex={-1} className="text-sm font-semibold text-muted outline-none">
          Paso {paso} de {TOTAL} · {NOMBRE_PASO[paso - 1]}
        </p>
      </div>

      {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para enviar la solicitud. Lo que escribiste se conserva.</Aviso>}

      {paso === 1 && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <SelectField
              label="Organización que quieres visitar"
              placeholder={organizaciones.length ? 'Seleccionar' : 'No hay organizaciones disponibles'}
              options={organizaciones.map((o) => ({ value: o.id, label: o.nombre }))}
              value={d.orgId}
              disabled={organizaciones.length === 0}
              error={errores.orgId}
              help="Solo aparecen organizaciones (iglesias, fundaciones, asilos, universidades…). Por privacidad no mostramos a las personas mayores ni a las familias."
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
            help="La organización la usa para saber quién visitará. No se muestra a nadie más."
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
          <div className="md:col-span-2">
            <TextField
              label="Correo electrónico (opcional)"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ejemplo@correo.com"
              value={d.correo}
              error={errores.correo}
              onChange={(e) => set('correo', e.target.value)}
            />
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <TextField
              label="¿A quién quieres visitar?"
              placeholder="Nombre de la persona"
              maxLength={120}
              value={d.personaAVisitar}
              error={errores.personaAVisitar}
              help="Escribe el nombre como lo conoces. Quien autorice la visita confirmará a qué persona corresponde; no verás su perfil."
              onChange={(e) => set('personaAVisitar', e.target.value)}
            />
          </div>
          <TextField
            label="Fecha propuesta"
            type="date"
            min={hoy}
            value={d.fechaPropuesta}
            error={errores.fechaPropuesta}
            onChange={(e) => set('fechaPropuesta', e.target.value)}
          />
          <TextField label="Hora propuesta" type="time" value={d.horaPropuesta} error={errores.horaPropuesta} onChange={(e) => set('horaPropuesta', e.target.value)} />
          <div className="md:col-span-2">
            <TextareaField
              label="Motivo de la visita"
              maxLength={300}
              rows={3}
              placeholder="Por ejemplo: acompañar un rato y conversar."
              value={d.motivo}
              error={errores.motivo}
              hint={`${d.motivo.length}/300`}
              onChange={(e) => set('motivo', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Checkbox
              checked={acepto}
              error={errores.acepto}
              className="leading-snug"
              onChange={(e) => {
                setAcepto(e.target.checked)
                setErrores((x) => ({ ...x, acepto: undefined }))
              }}
              label={
                <>
                  He leído la <Link to="/privacidad">Política de Privacidad</Link> y acepto que CuidaRed use mis datos para gestionar esta solicitud.
                </>
              }
            />
          </div>
        </div>
      )}

      {general && <Aviso tono="error">{general}</Aviso>}

      <div className="flex flex-col gap-2">
        <Button type="submit" fullWidth loading={cargando} disabled={!enLinea}>
          {paso === TOTAL ? (cargando ? 'Enviando…' : 'Enviar solicitud') : 'Siguiente'}
        </Button>
        {paso > 1 && (
          <Button variant="outline" fullWidth onClick={() => irA(paso - 1)}>
            Anterior
          </Button>
        )}
      </div>
    </form>
  )
}
