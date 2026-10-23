/*
 * RegistroOrganizacion.tsx — "/registro-organizacion": incorpora una organización a CuidaRed con su primera
 * cuenta de Administrador (Req. de negocio 8.1). Pasos:
 *  1) Organización (Cuenta: nombre, tipo, categoría)
 *  2) Contacto y ubicación (Cuenta: provincia → municipio, dirección, teléfono, correo)
 *  3) Plan (Plan) con prueba gratuita de 30 días: sin cobros (SRS §8.1)
 *  4) Datos del administrador (Usuario)  5) Contraseña + aceptación de términos y privacidad.
 * Módulo: auth (SRS §8.2.2.3.5 b · Ley 172-13).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Gift } from 'lucide-react'
import { Button, PasswordField, SelectField, StepBar, TextField } from '@/components/ui'
import { HOME_BY_ROL } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { useDB } from '@/domain/store'
import { cn } from '@/lib/cn'
import { useBorrador } from '@/lib/useBorrador'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, CasillaLegal, Lead, RequisitosPassword, YaTienesCuenta } from '../components/Piezas'
import {
  DIAS_PRUEBA_GRATUITA,
  guardarMemoria,
  leerMemoria,
  limpiarMemoria,
  registrarOrganizacion,
  validarAdministrador,
  validarOrganizacion,
  validarPlan,
  type Errores,
} from '../lib/registro'
import { errorConfirmacion, formatCedula, formatTelefono, hayErrores } from '../lib/validar'

const FLUJO = 'organizacion'
const INICIAL = {
  paso: 1,
  nombreOrg: '',
  tipoCuentaId: '',
  categoriaCuentaId: '',
  provinciaCod: '',
  municipioCod: '',
  direccion: '',
  telefonoOrg: '',
  correoOrg: '',
  planId: '',
  cedula: '',
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
}
type Campo = Exclude<keyof typeof INICIAL, 'paso'>
const TOTAL = 5
const NOMBRE_PASO = ['Organización', 'Contacto y ubicación', 'Plan', 'Administrador', 'Contraseña']
/** Campos validados en cada paso (para volver al paso con errores si el servidor los rechaza). */
const CAMPOS_PASO: Record<number, string[]> = {
  1: ['nombreOrg', 'tipoCuentaId', 'categoriaCuentaId'],
  2: ['provinciaCod', 'municipioCod', 'direccion', 'telefonoOrg', 'correoOrg'],
  3: ['planId'],
  4: ['cedula', 'nombre', 'apellido', 'telefono', 'email'],
}
const soloPaso = (errores: Errores, paso: number) => Object.fromEntries(Object.entries(errores).filter(([k]) => CAMPOS_PASO[paso]?.includes(k)))

const moneda = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 })
const PERIODO = { mensual: 'al mes', anual: 'al año', unico: 'pago único' } as const

export default function RegistroOrganizacion() {
  const navigate = useNavigate()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const [d, setD, descartar] = useBorrador('registro-organizacion', INICIAL)
  const [memoria] = useState(() => leerMemoria(FLUJO))
  const [password, setPassword] = useState(memoria.password)
  const [confirmar, setConfirmar] = useState(memoria.confirmar)
  const [acepto, setAcepto] = useState(memoria.acepto)
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)
  const paso = d.paso

  const planes = useMemo(() => catalogos.planes.filter((p) => p.estado === 'activo'), [catalogos])
  const planId = d.planId || planes[0]?.id || ''
  const municipios = useMemo(
    () => catalogos.municipios.filter((m) => m.provinciaCod === d.provinciaCod).map((m) => ({ value: m.cod, label: m.nombre })),
    [catalogos, d.provinciaCod],
  )

  const set = (campo: Campo, valor: string) => {
    setD((x) => ({ ...x, [campo]: valor }))
    setErrores((x) => ({ ...x, [campo]: undefined }))
    setGeneral(undefined)
  }
  const recordar = (m: Partial<{ password: string; confirmar: string; acepto: boolean }>) => guardarMemoria(FLUJO, { password, confirmar, acepto, ...m })
  const irA = (p: number) => {
    setErrores({})
    setGeneral(undefined)
    setD((x) => ({ ...x, paso: p }))
  }
  const cancelar = () => {
    descartar()
    limpiarMemoria(FLUJO)
    navigate('/inicio')
  }
  const volver = () => (paso > 1 ? irA(paso - 1) : navigate('/inicio'))

  const org = {
    nombre: d.nombreOrg,
    tipoCuentaId: d.tipoCuentaId,
    categoriaCuentaId: d.categoriaCuentaId,
    provinciaCod: d.provinciaCod,
    municipioCod: d.municipioCod,
    direccion: d.direccion,
    telefono: d.telefonoOrg,
    correo: d.correoOrg,
  }
  const admin = { cedula: d.cedula, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono, email: d.email }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (cargando) return
    if (paso < TOTAL) {
      const v = paso <= 2 ? soloPaso(validarOrganizacion(org), paso) : paso === 3 ? validarPlan(planId) : validarAdministrador(admin)
      setErrores(v)
      if (!hayErrores(v)) {
        if (paso === 3 && !d.planId) setD((x) => ({ ...x, planId }))
        irA(paso + 1)
      }
      return
    }
    const local: Errores = { confirmar: errorConfirmacion(password, confirmar) }
    setCargando(true)
    try {
      const res = await registrarOrganizacion(org, planId, admin, password, acepto)
      if (res.ok) {
        descartar()
        limpiarMemoria(FLUJO)
        navigate(HOME_BY_ROL.admin, { replace: true })
        return
      }
      const errs = { ...local, ...('errores' in res ? res.errores : undefined) }
      const pasoConError = [1, 2, 3, 4].find((p) => CAMPOS_PASO[p]!.some((c) => errs[c]))
      if (pasoConError) setD((x) => ({ ...x, paso: pasoConError }))
      setErrores(errs)
      setGeneral(hayErrores(errs) ? undefined : res.error)
    } finally {
      setCargando(false)
    }
  }

  const nombreOrg = d.nombreOrg.trim() || 'la organización'

  return (
    <AuthScreen title="Registrar organización" back={volver}>
      <form className="flex min-w-0 flex-1 flex-col gap-5" onSubmit={enviar} noValidate aria-busy={cargando || undefined}>
        <LogoBadge />
        <StepBar step={paso} total={TOTAL} />
        <p className="-mt-2 text-sm font-semibold text-muted">
          Paso {paso} de {TOTAL} · {NOMBRE_PASO[paso - 1]}
        </p>

        {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para registrar la organización.</Aviso>}

        {paso === 1 && (
          <>
            <Lead>Registra tu organización para gestionar desde un solo lugar adultos mayores, voluntarios, visitas y alertas.</Lead>
            <TextField label="Nombre de la organización" autoComplete="organization" value={d.nombreOrg} error={errores.nombreOrg} onChange={(e) => set('nombreOrg', e.target.value)} />
            <SelectField
              label="Tipo de organización"
              placeholder="Seleccionar"
              options={catalogos.tiposCuenta.map((t) => ({ value: t.id, label: t.nombre }))}
              value={d.tipoCuentaId}
              error={errores.tipoCuentaId}
              onChange={(e) => set('tipoCuentaId', e.target.value)}
            />
            <SelectField
              label="Categoría"
              placeholder="Seleccionar"
              options={catalogos.categoriasCuenta.map((c) => ({ value: c.id, label: c.nombre }))}
              value={d.categoriaCuentaId}
              error={errores.categoriaCuentaId}
              help="Comunitaria (organizaciones de base y juntas de vecinos), religiosa, sin fines de lucro o institucional."
              onChange={(e) => set('categoriaCuentaId', e.target.value)}
            />
          </>
        )}

        {paso === 2 && (
          <>
            <Lead>
              ¿Dónde y cómo contactar a <strong className="text-ink">{nombreOrg}</strong>?
            </Lead>
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                label="Provincia"
                placeholder="Seleccionar"
                options={catalogos.provincias.map((p) => ({ value: p.cod, label: p.nombre }))}
                value={d.provinciaCod}
                error={errores.provinciaCod}
                onChange={(e) => {
                  set('provinciaCod', e.target.value)
                  setD((x) => ({ ...x, municipioCod: '' }))
                }}
              />
              <SelectField
                label="Municipio"
                placeholder={d.provinciaCod ? 'Seleccionar' : 'Elige primero la provincia'}
                options={municipios}
                value={d.municipioCod}
                disabled={!d.provinciaCod}
                error={errores.municipioCod}
                onChange={(e) => set('municipioCod', e.target.value)}
              />
            </div>
            <TextField
              label="Dirección (opcional)"
              autoComplete="street-address"
              maxLength={150}
              placeholder="Calle, número, sector"
              value={d.direccion}
              error={errores.direccion}
              onChange={(e) => set('direccion', e.target.value)}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                label="Teléfono institucional"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="000 000 0000"
                maxLength={12}
                value={d.telefonoOrg}
                error={errores.telefonoOrg}
                onChange={(e) => set('telefonoOrg', formatTelefono(e.target.value))}
              />
              <TextField
                label="Correo institucional (opcional)"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="contacto@organizacion.org"
                value={d.correoOrg}
                error={errores.correoOrg}
                onChange={(e) => set('correoOrg', e.target.value)}
              />
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            <Aviso tono="info" icono={<Gift size={18} />}>
              <strong>{DIAS_PRUEBA_GRATUITA} días de prueba gratuita</strong> con cualquier plan. CuidaRed no procesa cobros en esta versión: no se te pedirá ningún
              medio de pago.
            </Aviso>
            <fieldset className="flex flex-col gap-3 min-w-0">
              <legend className="mb-2 text-base font-semibold text-ink">Elige un plan</legend>
              {planes.map((p) => {
                const on = planId === p.id
                return (
                  <label
                    key={p.id}
                    className={cn(
                      'flex items-start gap-3 min-h-12 p-4 rounded-md border cursor-pointer transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-blue/40',
                      on ? 'border-navy bg-blue-100' : 'border-line bg-bg hover:bg-blue-100/50',
                      errores.planId && 'border-danger',
                    )}
                  >
                    <input type="radio" name="plan" value={p.id} checked={on} onChange={() => set('planId', p.id)} className="sr-only" />
                    <span aria-hidden className={cn('grid place-items-center size-6 mt-0.5 flex-none rounded-full border-2', on ? 'border-navy bg-navy text-white' : 'border-line bg-bg')}>
                      {on && <Check size={14} strokeWidth={4} />}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <strong className="text-lg text-ink">{p.nombre}</strong>
                        <span className="font-bold text-navy">{p.precio === 0 ? 'Gratis' : `${moneda.format(p.precio)} ${PERIODO[p.periodicidad]}`}</span>
                      </span>
                      <span className="text-sm text-ink-2">
                        Hasta {p.limiteEnvejecientes} adultos mayores y {p.limiteUsuarios} usuarios
                      </span>
                    </span>
                  </label>
                )
              })}
              {errores.planId && <Aviso tono="error">{errores.planId}</Aviso>}
            </fieldset>
            <p className="text-sm text-muted">Podrás cambiar de plan más adelante desde «Plan y suscripción».</p>
          </>
        )}

        {paso === 4 && (
          <>
            <Lead>
              Datos de la persona que administrará <strong className="text-ink">{nombreOrg}</strong>. Será la titular de la cuenta y podrá crear las cuentas de
              coordinadores, voluntarios y familiares.
            </Lead>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
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
              </div>
              <TextField label="Nombre" autoComplete="given-name" value={d.nombre} error={errores.nombre} onChange={(e) => set('nombre', e.target.value)} />
              <TextField label="Apellido" autoComplete="family-name" value={d.apellido} error={errores.apellido} onChange={(e) => set('apellido', e.target.value)} />
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
              <TextField
                label="Correo electrónico"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ejemplo@correo.com"
                value={d.email}
                error={errores.email}
                hint="Lo usarás para iniciar sesión."
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </>
        )}

        {paso === 5 && (
          <>
            <Lead>Crea la contraseña de la cuenta de administrador.</Lead>
            <PasswordField
              label="Contraseña"
              autoComplete="new-password"
              value={password}
              error={errores.password}
              onChange={(e) => {
                setPassword(e.target.value)
                recordar({ password: e.target.value })
                setErrores((x) => ({ ...x, password: undefined }))
              }}
            />
            <PasswordField
              label="Confirmar contraseña"
              autoComplete="new-password"
              value={confirmar}
              error={errores.confirmar}
              onChange={(e) => {
                setConfirmar(e.target.value)
                recordar({ confirmar: e.target.value })
                setErrores((x) => ({ ...x, confirmar: undefined }))
              }}
            />
            <RequisitosPassword password={password} confirmar={confirmar} />
            <CasillaLegal
              checked={acepto}
              error={errores.acepto}
              onChange={(v) => {
                setAcepto(v)
                recordar({ acepto: v })
                setErrores((x) => ({ ...x, acepto: undefined }))
              }}
            />
          </>
        )}

        {general && <Aviso tono="error">{general}</Aviso>}

        <Acciones>
          <Button type="submit" variant={paso === TOTAL ? 'primary' : 'light'} fullWidth loading={cargando} disabled={!enLinea}>
            {paso === TOTAL ? (cargando ? 'Registrando…' : 'Registrar organización') : 'Siguiente'}
          </Button>
          <Button variant="ghost" fullWidth onClick={cancelar}>
            Cancelar
          </Button>
          <YaTienesCuenta />
        </Acciones>
      </form>
    </AuthScreen>
  )
}
