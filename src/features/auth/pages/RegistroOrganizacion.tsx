/*
 * RegistroOrganizacion.tsx — "/registro-organizacion": incorpora una organización a CuidaRed con su primera
 * cuenta de Administrador (Req. de negocio 8.1). Pasos:
 *  1) Organización (Cuenta: nombre y categoría)
 *  2) Contacto y ubicación (Cuenta: provincia → municipio, dirección, teléfono, correo)
 *  3) Datos del administrador (Usuario)  4) Contraseña + aceptación de términos y privacidad.
 * No se pide plan: la cuenta nace con 14 días de prueba gratuita (sin tarjeta) y funciones limitadas; el plan
 * se elige cuando la prueba está por terminar (feedback de PM · LOGIN SCREEN).
 * Módulo: auth (SRS §8.2.2.3.5 b · Ley 172-13).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { Button, SelectField, StepBar, TextField } from '@/components/ui'
import { HOME_BY_ROL } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { DIAS_PRUEBA_GRATUITA } from '@/domain/planes'
import { useDB } from '@/domain/store'
import { useBorrador } from '@/lib/useBorrador'
import { AuthScreen } from '../components/AuthScreen'
import { CamposClave, CamposTitular, SelectoresUbicacion } from '../components/CamposCuenta'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, Lead, YaTienesCuenta } from '../components/Piezas'
import {
  categoriasDeTipo,
  guardarMemoria,
  leerMemoria,
  limpiarMemoria,
  registrarOrganizacion,
  ROL_TITULAR,
  validarOrganizacion,
  validarTitular,
  type Errores,
} from '../lib/registro'
import { errorConfirmacion, formatTelefono, hayErrores } from '../lib/validar'

const FLUJO = 'organizacion'
const INICIAL = {
  paso: 1,
  nombreOrg: '',
  categoriaCuentaId: '',
  provinciaCod: '',
  municipioCod: '',
  direccion: '',
  telefonoOrg: '',
  correoOrg: '',
  cedula: '',
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
}
type Campo = Exclude<keyof typeof INICIAL, 'paso'>
const TOTAL = 4
const NOMBRE_PASO = ['Organización', 'Contacto y ubicación', 'Administrador', 'Contraseña']
/** Campos validados en cada paso (para volver al paso con errores si el servidor los rechaza). */
const CAMPOS_PASO: Record<number, string[]> = {
  1: ['nombreOrg', 'categoriaCuentaId'],
  2: ['provinciaCod', 'municipioCod', 'direccion', 'telefonoOrg', 'correoOrg'],
  3: ['cedula', 'nombre', 'apellido', 'telefono', 'email'],
}
const soloPaso = (errores: Errores, paso: number) => Object.fromEntries(Object.entries(errores).filter(([k]) => CAMPOS_PASO[paso]?.includes(k)))

export default function RegistroOrganizacion() {
  const navigate = useNavigate()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const [d, setD, descartar] = useBorrador('cuenta-organizacion', INICIAL)
  const [memoria] = useState(() => leerMemoria(FLUJO))
  const [password, setPassword] = useState(memoria.password)
  const [confirmar, setConfirmar] = useState(memoria.confirmar)
  const [acepto, setAcepto] = useState(memoria.acepto)
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)
  const paso = Math.min(Math.max(d.paso, 1), TOTAL)

  const categorias = useMemo(() => categoriasDeTipo(catalogos, 'organizacion').map((c) => ({ value: c.id, label: c.nombre })), [catalogos])

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
  const volver = () => (paso > 1 ? irA(paso - 1) : navigate('/crear-cuenta'))

  const org = {
    nombre: d.nombreOrg,
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
      const v = paso <= 2 ? soloPaso(validarOrganizacion(org), paso) : validarTitular(admin)
      setErrores(v)
      if (!hayErrores(v)) irA(paso + 1)
      return
    }
    const local: Errores = { confirmar: errorConfirmacion(password, confirmar) }
    setCargando(true)
    try {
      const res = await registrarOrganizacion(org, admin, password, acepto)
      if (res.ok) {
        descartar()
        limpiarMemoria(FLUJO)
        navigate(HOME_BY_ROL[ROL_TITULAR.organizacion], { replace: true })
        return
      }
      const errs = { ...local, ...('errores' in res ? res.errores : undefined) }
      const pasoConError = [1, 2, 3].find((p) => CAMPOS_PASO[p]!.some((c) => errs[c]))
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
            <Aviso tono="info" icono={<Gift size={18} />}>
              <strong>{DIAS_PRUEBA_GRATUITA} días gratis, sin tarjeta.</strong> Empiezas con una prueba de funciones limitadas; cuando esté por terminar podrás elegir un plan.
            </Aviso>
            <TextField label="Nombre de la organización" autoComplete="organization" value={d.nombreOrg} error={errores.nombreOrg} onChange={(e) => set('nombreOrg', e.target.value)} />
            <SelectField
              label="Categoría"
              placeholder="Seleccionar"
              options={categorias}
              value={d.categoriaCuentaId}
              error={errores.categoriaCuentaId}
              help="Asilo, iglesia, universidad o fundación: elige la que mejor describa a tu organización."
              onChange={(e) => set('categoriaCuentaId', e.target.value)}
            />
          </>
        )}

        {paso === 2 && (
          <>
            <Lead>
              ¿Dónde y cómo contactar a <strong className="text-ink">{nombreOrg}</strong>?
            </Lead>
            <SelectoresUbicacion
              provinciaCod={d.provinciaCod}
              municipioCod={d.municipioCod}
              errores={errores}
              onProvincia={(cod) => {
                set('provinciaCod', cod)
                setD((x) => ({ ...x, municipioCod: '' }))
              }}
              onMunicipio={(cod) => set('municipioCod', cod)}
            />
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
            <Lead>
              Datos de la persona que administrará <strong className="text-ink">{nombreOrg}</strong>. Será la titular de la cuenta y podrá invitar a coordinadores,
              cuidadores, voluntarios y familiares.
            </Lead>
            <CamposTitular valores={admin} errores={errores} onCambio={(campo, valor) => set(campo, valor)} />
          </>
        )}

        {paso === 4 && (
          <>
            <Lead>Crea la contraseña de la cuenta de administrador.</Lead>
            <CamposClave
              password={password}
              confirmar={confirmar}
              acepto={acepto}
              errores={errores}
              onPassword={(v) => {
                setPassword(v)
                recordar({ password: v })
                setErrores((x) => ({ ...x, password: undefined }))
              }}
              onConfirmar={(v) => {
                setConfirmar(v)
                recordar({ confirmar: v })
                setErrores((x) => ({ ...x, confirmar: undefined }))
              }}
              onAcepto={(v) => {
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
