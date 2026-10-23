/*
 * Configuracion.tsx — Configuración de la organización en dos secciones:
 *  1) Datos de la cuenta (tabla Cuenta): nombre, tipo (TipoCuenta), categoría (Categoria_cuenta),
 *     provincia → municipio (Municipio_Cod), dirección, teléfono y correo; fecha de creación y titular
 *     (User_Titular) en solo lectura. Se guarda con actualizarCuenta.
 *  2) Parámetros (tablas Parametros + Configuracion_Cuenta): un control por parámetro según su tipo (número,
 *     interruptor o texto), con su descripción como ayuda, el valor por defecto y la fecha de la última
 *     actualización. Se guarda con guardarParametros.
 * Módulo: admin (CU-13 · RF-05 · SRS §8.2.2.1.18 Operabilidad · §8.2.2.3.5 d).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight, Minus, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Button, HelpTip, IconTile, SelectField, Switch, TextField, useToast } from '@/components/ui'
import { actualizarCuenta, guardarParametros, type DatosCuenta } from '@/domain/api'
import { useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { PARAM } from '@/domain/datosMaestros'
import { puede } from '@/domain/permisos'
import { nombreMunicipio, nombreUsuario, provinciaDe, valorParametro } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Organizacion, Parametro } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useBorrador } from '@/lib/useBorrador'
import { Page, useShell } from '@/layouts/AppShell'
import { AvisoSinConexion, Nota } from '../components/Nota'

const TARJETA = 'flex flex-col gap-4 p-5 rounded-md'
const AZUL = 'bg-blue-100 border border-[#a9cdf1]'
const BLANCA = 'bg-surface shadow-1'
const TITULO = 'flex items-center gap-2 pb-3 border-b border-line-soft text-lg font-bold text-ink'

export default function Configuracion() {
  const { base } = useShell()
  const { org } = useSession()
  return (
    <Page title="Configurar organización" back={`${base}/mas`} wide>
      {org ? (
        <>
          <Cabecera org={org} />
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <DatosDeLaCuenta key={`c-${org.id}`} org={org} />
            <Parametros key={`p-${org.id}`} org={org} />
          </div>
        </>
      ) : null}
    </Page>
  )
}

function Cabecera({ org }: { org: Organizacion }) {
  const { base } = useShell()
  const user = useUser()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const tipo = catalogos.tiposCuenta.find((t) => t.id === org.tipoCuentaId)?.nombre
  const lugar = [nombreMunicipio(catalogos, org.municipioCod), provinciaDe(catalogos, org.municipioCod)?.nombre].filter(Boolean).join(', ')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <IconTile size={64}>
          <Building2 size={32} aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-tight wrap-anywhere">{org.nombre}</h2>
          <p className="text-sm text-muted">{[tipo, lugar].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {!enLinea && <AvisoSinConexion />}
      {puede(user, 'cuenta:suscripcion') && (
        <Link to={`${base}/suscripcion`} className="flex items-center justify-between gap-3 min-h-12 px-4 py-2 rounded-md border border-line-soft bg-bg text-sm font-semibold text-navy hover:bg-blue-100/60">
          <span>El plan, la prueba gratuita y los pagos se gestionan en «Plan y suscripción».</span>
          <ChevronRight size={18} className="flex-none" aria-hidden />
        </Link>
      )}
    </div>
  )
}

/* ───────────── 1. Datos de la cuenta (tabla Cuenta) ───────────── */

type CamposCuenta = DatosCuenta & { provinciaCod: string }

function DatosDeLaCuenta({ org }: { org: Organizacion }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const usuarios = useDB((s) => s.usuarios)

  const inicial: CamposCuenta = {
    nombre: org.nombre,
    tipoCuentaId: org.tipoCuentaId,
    categoriaCuentaId: org.categoriaCuentaId,
    provinciaCod: provinciaDe(catalogos, org.municipioCod)?.cod ?? '',
    municipioCod: org.municipioCod,
    direccion: org.direccion,
    telefono: org.telefono,
    correo: org.correo,
  }
  const [d, setD, descartar] = useBorrador<CamposCuenta>(`admin:config-cuenta:${org.id}`, inicial)
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})

  const municipios = useMemo(
    () => catalogos.municipios.filter((m) => m.provinciaCod === d.provinciaCod).map((m) => ({ value: m.cod, label: m.nombre })),
    [catalogos, d.provinciaCod],
  )
  const set = <K extends keyof CamposCuenta>(k: K, v: CamposCuenta[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    const { provinciaCod: _p, ...datos } = d
    void _p
    const r = actualizarCuenta(user, datos)
    if (!r.ok) {
      setErrores(r.errores ?? {})
      toast(r.error, 'error')
      return
    }
    descartar()
    setErrores({})
    toast('Datos de la cuenta guardados')
  }

  return (
    <form className={cn(TARJETA, AZUL)} onSubmit={guardar} noValidate aria-labelledby="h-cuenta">
      <h3 id="h-cuenta" className={TITULO}>
        <Building2 size={20} className="text-navy" aria-hidden /> Datos de la cuenta
      </h3>
      <TextField
        label="Nombre de la organización"
        required
        autoComplete="organization"
        value={d.nombre}
        error={errores.nombre}
        onChange={(e) => set('nombre', e.target.value)}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Tipo de organización"
          required
          placeholder="Seleccionar"
          options={catalogos.tiposCuenta.map((t) => ({ value: t.id, label: t.nombre }))}
          value={d.tipoCuentaId}
          error={errores.tipoCuentaId}
          onChange={(e) => set('tipoCuentaId', e.target.value)}
        />
        <SelectField
          label="Categoría"
          required
          placeholder="Seleccionar"
          options={catalogos.categoriasCuenta.map((t) => ({ value: t.id, label: t.nombre }))}
          value={d.categoriaCuentaId}
          error={errores.categoriaCuentaId}
          help={catalogos.categoriasCuenta.find((c) => c.id === d.categoriaCuentaId)?.descripcion ?? 'Clasificación de la organización (comunitaria, religiosa, sin fines de lucro o institucional).'}
          onChange={(e) => set('categoriaCuentaId', e.target.value)}
        />
        <SelectField
          label="Provincia"
          required
          placeholder="Seleccionar"
          options={catalogos.provincias.map((p) => ({ value: p.cod, label: p.nombre }))}
          value={d.provinciaCod}
          onChange={(e) => {
            const cod = e.target.value
            setD((x) => ({ ...x, provinciaCod: cod, municipioCod: catalogos.municipios.find((m) => m.provinciaCod === cod)?.cod ?? '' }))
            setErrores((x) => ({ ...x, municipioCod: undefined }))
          }}
        />
        <SelectField
          label="Municipio"
          required
          placeholder={d.provinciaCod ? 'Seleccionar' : 'Elige primero la provincia'}
          disabled={!d.provinciaCod}
          options={municipios}
          value={d.municipioCod}
          error={errores.municipioCod}
          onChange={(e) => set('municipioCod', e.target.value)}
        />
      </div>
      <TextField
        label="Dirección"
        autoComplete="street-address"
        maxLength={150}
        placeholder="Calle, número, sector"
        value={d.direccion}
        error={errores.direccion}
        onChange={(e) => set('direccion', e.target.value)}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Teléfono institucional"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={d.telefono}
          error={errores.telefono}
          onChange={(e) => set('telefono', e.target.value)}
        />
        <TextField
          label="Correo institucional"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="contacto@organizacion.org"
          value={d.correo}
          error={errores.correo}
          onChange={(e) => set('correo', e.target.value)}
        />
      </div>
      <dl className="grid grid-cols-2 gap-4 pt-3 border-t border-[#a9cdf1] text-sm">
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="text-xs font-bold uppercase tracking-wide text-muted">Fecha de creación</dt>
          <dd className="font-semibold text-ink">{fechaCorta(org.creadoEn)}</dd>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <dt className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted">
            Titular de la cuenta
            <HelpTip label="Ayuda: titular">Administrador responsable de la cuenta ante CuidaRed (User_Titular). Se asigna al registrar la organización.</HelpTip>
          </dt>
          <dd className="font-semibold text-ink wrap-anywhere">{nombreUsuario(usuarios, org.usuarioTitularId)}</dd>
        </div>
      </dl>
      <Button type="submit" fullWidth disabled={!enLinea}>
        Guardar datos de la cuenta
      </Button>
    </form>
  )
}

/* ───────────── 2. Parámetros (Parametros + Configuracion_Cuenta) ───────────── */

/** Rango permitido de un parámetro numérico (la capa de servicios lo vuelve a validar). */
const rango = (p: Parametro) => ({ min: 1, max: p.clave === PARAM.DIAS_SIN_VISITA_ALERTA ? 90 : 365 })

function Parametros({ org }: { org: Organizacion }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const configuracion = useDB((s) => s.configuracion)
  const parametros = catalogos.parametros

  const guardados = useMemo(
    () => Object.fromEntries(parametros.map((p) => [p.clave, valorParametro({ catalogos, configuracion }, org.id, p.clave)])),
    [parametros, catalogos, configuracion, org.id],
  )
  const [valores, setValores, descartar] = useBorrador<Record<string, string>>(`admin:config-parametros:${org.id}`, guardados)
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})

  const set = (clave: string, v: string) => {
    setValores((x) => ({ ...x, [clave]: v }))
    if (errores[clave]) setErrores((e) => ({ ...e, [clave]: undefined }))
  }
  const cambios = parametros.filter((p) => (valores[p.clave] ?? '') !== guardados[p.clave]).length

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    const r = guardarParametros(user, Object.fromEntries(parametros.map((p) => [p.clave, valores[p.clave] ?? p.valorDefecto])))
    if (!r.ok) {
      setErrores(r.errores ?? {})
      toast(r.error, 'error')
      return
    }
    descartar()
    setErrores({})
    const dias = valores[PARAM.DIAS_SIN_VISITA_ALERTA]
    toast(dias !== guardados[PARAM.DIAS_SIN_VISITA_ALERTA] ? `Parámetros guardados. Las alertas de seguimiento usarán ${dias} días.` : 'Parámetros guardados')
  }

  return (
    <form className={cn(TARJETA, BLANCA)} onSubmit={guardar} noValidate aria-labelledby="h-parametros">
      <h3 id="h-parametros" className={TITULO}>
        <SlidersHorizontal size={20} className="text-navy" aria-hidden /> Parámetros
      </h3>
      <p className="-mt-1 text-sm text-muted">Valores que usa CuidaRed en tu organización. Si no cambias uno, se usa su valor por defecto.</p>
      <ul className="flex flex-col divide-y divide-line-soft">
        {parametros.map((p) => {
          const conf = configuracion.find((c) => c.orgId === org.id && c.parametroId === p.id)
          return (
            <li key={p.id} className="py-4 first:pt-0">
              <ControlParametro
                parametro={p}
                valor={valores[p.clave] ?? p.valorDefecto}
                error={errores[p.clave]}
                actualizado={conf?.actualizadoEn}
                onChange={(v) => set(p.clave, v)}
              />
            </li>
          )
        })}
      </ul>
      <Nota>Al guardar, los cambios se aplican de inmediato; por ejemplo, el nuevo umbral de días sin visita genera o cierra las alertas de seguimiento (RF-05).</Nota>
      <Button type="submit" fullWidth disabled={!enLinea}>
        {cambios > 0 ? `Guardar parámetros (${cambios} cambio${cambios === 1 ? '' : 's'})` : 'Guardar parámetros'}
      </Button>
    </form>
  )
}

const textoDefecto = (p: Parametro) => (p.tipo === 'booleano' ? (p.valorDefecto === 'true' ? 'Activado' : 'Desactivado') : p.valorDefecto || 'vacío')

function ControlParametro({
  parametro: p,
  valor,
  error,
  actualizado,
  onChange,
}: {
  parametro: Parametro
  valor: string
  error?: string
  actualizado?: string
  onChange: (v: string) => void
}) {
  const id = useId()
  const pie = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span>
        Por defecto: <strong className="text-ink-2">{textoDefecto(p)}</strong>
      </span>
      <span>{actualizado ? `Actualizado: ${fechaHora(actualizado)}` : 'Usa el valor por defecto'}</span>
      {valor !== p.valorDefecto && (
        <button type="button" className="inline-flex items-center gap-1 min-h-12 font-bold text-navy hover:underline" onClick={() => onChange(p.valorDefecto)}>
          <RotateCcw size={14} aria-hidden /> Restablecer
        </button>
      )}
    </span>
  )

  if (p.tipo === 'booleano') {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="flex items-center gap-1">
              <label htmlFor={id} className="text-base font-bold leading-snug text-ink cursor-pointer">
                {p.nombre}
              </label>
            </span>
            <p className="text-sm text-muted leading-snug">{p.descripcion}</p>
          </div>
          <Switch id={id} checked={valor === 'true'} onChange={(v) => onChange(v ? 'true' : 'false')} />
        </div>
        {pie}
      </div>
    )
  }

  if (p.tipo === 'numero') {
    const { min, max } = rango(p)
    const n = Number.parseInt(valor, 10)
    const paso = (delta: number) => onChange(String(Math.min(max, Math.max(min, (Number.isFinite(n) ? n : Number(p.valorDefecto)) + delta))))
    return (
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1">
          <label htmlFor={id} className="text-base font-bold text-ink">
            {p.nombre}
          </label>
          <HelpTip label={`Ayuda: ${p.nombre}`}>{p.descripcion}</HelpTip>
        </span>
        <div className={cn('flex items-center gap-2 p-1 rounded-md bg-[#eef2f8] border', error ? 'border-danger' : 'border-line-soft')}>
          <button
            type="button"
            className="grid place-items-center size-[52px] flex-none rounded-sm bg-white text-navy shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:enabled:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Disminuir ${p.nombre.toLowerCase()}`}
            disabled={n <= min}
            onClick={() => paso(-1)}
          >
            <Minus size={20} aria-hidden />
          </button>
          <div className="flex-1 flex items-baseline justify-center gap-1 text-navy">
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={valor}
              aria-invalid={!!error || undefined}
              aria-describedby={`${id}-d`}
              onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
              className="w-20 min-h-12 bg-transparent text-center text-2xl font-bold rounded-sm focus:outline-none focus:ring-[3px] focus:ring-blue/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-sm font-semibold">{n === 1 ? 'día' : 'días'}</span>
          </div>
          <button
            type="button"
            className="grid place-items-center size-[52px] flex-none rounded-sm bg-white text-navy shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:enabled:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Aumentar ${p.nombre.toLowerCase()}`}
            disabled={n >= max}
            onClick={() => paso(1)}
          >
            <Plus size={20} aria-hidden />
          </button>
        </div>
        {error ? (
          <p className="text-danger text-sm" role="alert" id={`${id}-d`}>
            {error}
          </p>
        ) : (
          <p className="text-muted text-sm" id={`${id}-d`}>
            Entre {min} y {max} días.
          </p>
        )}
        {pie}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <TextField
        id={id}
        label={p.nombre}
        type={p.clave === PARAM.CONTACTO_INSTITUCIONAL_TELEFONO ? 'tel' : 'text'}
        inputMode={p.clave === PARAM.CONTACTO_INSTITUCIONAL_TELEFONO ? 'tel' : undefined}
        maxLength={120}
        autoComplete="off"
        value={valor}
        error={error}
        help={p.descripcion}
        onChange={(e) => onChange(e.target.value)}
      />
      {pie}
    </div>
  )
}
