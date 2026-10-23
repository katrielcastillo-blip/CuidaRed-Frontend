/*
 * Registro.tsx — "/registro": activación de una cuenta creada por el administrador de la organización.
 *  1) Correo de la invitación  2) Datos personales  3) Contraseña propia + aceptación de términos y privacidad.
 * Módulo: auth (CU-01 · CU-13 · SRS §8.2.2.3.5 b: política de contraseñas · Ley 172-13: consentimiento).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, MailQuestion } from 'lucide-react'
import { Button, PasswordField, StepBar, TextField } from '@/components/ui'
import { HOME_BY_ROL, ROL_LABEL } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { useBorrador } from '@/lib/useBorrador'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, CasillaLegal, Lead, RequisitosPassword, YaTienesCuenta } from '../components/Piezas'
import {
  activarCuenta,
  buscarInvitacion,
  datosInvitacion,
  guardarMemoria,
  leerMemoria,
  limpiarMemoria,
  MENSAJE_CODIGO_INVALIDO,
  MENSAJE_SIN_INVITACION,
  validarDatosPersonales,
  type Errores,
  type InvitacionEncontrada,
} from '../lib/registro'
import { errorConfirmacion, errorEmail, formatCedula, formatTelefono, hayErrores } from '../lib/validar'

const FLUJO = 'activar'
const INICIAL = { paso: 1, email: '', codigo: '', cedula: '', nombre: '', apellido: '', telefono: '' }
const CAMPOS_PASO_2 = ['cedula', 'nombre', 'apellido', 'telefono']

export default function Registro() {
  const navigate = useNavigate()
  const enLinea = useEnLinea()
  const [datos, setDatos, descartar] = useBorrador('activar-cuenta', INICIAL)
  const [memoria] = useState(() => leerMemoria(FLUJO))
  const [password, setPassword] = useState(memoria.password)
  const [confirmar, setConfirmar] = useState(memoria.confirmar)
  const [acepto, setAcepto] = useState(memoria.acepto)
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)
  // Al volver de leer los Términos se recupera la invitación del correo guardado en el borrador.
  const [invitacion, setInvitacion] = useState<InvitacionEncontrada | null>(() => {
    if (datos.paso === 1 || !datos.email) return null
    return datosInvitacion(datos.email)
  })
  const paso = invitacion ? datos.paso : 1

  const set = (campo: keyof typeof INICIAL, valor: string) => {
    setDatos((d) => ({ ...d, [campo]: valor }))
    setErrores((x) => ({ ...x, [campo]: undefined }))
    setGeneral(undefined)
  }
  const recordar = (m: Partial<{ password: string; confirmar: string; acepto: boolean }>) =>
    guardarMemoria(FLUJO, { password, confirmar, acepto, ...m })
  const irA = (p: number) => {
    setErrores({})
    setGeneral(undefined)
    setDatos((d) => ({ ...d, paso: p }))
  }
  const volver = () => (paso > 1 ? irA(paso - 1) : navigate('/inicio'))

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (cargando) return

    if (paso === 1) {
      const err = errorEmail(datos.email)
      const errCodigo = /^\d{6}$/.test(datos.codigo.trim()) ? undefined : 'Escribe el código de 6 dígitos que te dio tu organización.'
      if (err || errCodigo) return setErrores({ email: err, codigo: errCodigo })
      setCargando(true)
      const r = await buscarInvitacion(datos.email, datos.codigo)
      setCargando(false)
      if (!r.ok) return setGeneral(r.error)
      setInvitacion(r.valor)
      return irA(2)
    }

    if (paso === 2) {
      const v = validarDatosPersonales(datos)
      setErrores(v)
      if (!hayErrores(v)) irA(3)
      return
    }

    const v: Errores = {
      confirmar: errorConfirmacion(password, confirmar),
      acepto: acepto ? undefined : 'Debes aceptar los Términos y la Política de Privacidad.',
    }
    setCargando(true)
    try {
      const res = await activarCuenta(datos.email, datos.codigo, datos, password, acepto)
      if (res.ok) {
        descartar()
        limpiarMemoria(FLUJO)
        navigate(HOME_BY_ROL[res.user.rol], { replace: true })
        return
      }
      const errs = { ...v, ...('errores' in res ? res.errores : undefined) }
      if (CAMPOS_PASO_2.some((c) => errs[c])) {
        setDatos((d) => ({ ...d, paso: 2 }))
        setErrores(errs)
        return
      }
      if (res.error === MENSAJE_SIN_INVITACION || res.error === MENSAJE_CODIGO_INVALIDO) {
        setInvitacion(null)
        setDatos((d) => ({ ...d, paso: 1 }))
      }
      setErrores(errs)
      setGeneral(hayErrores(errs) ? undefined : res.error)
    } finally {
      setCargando(false)
    }
  }

  return (
    <AuthScreen title="Activar mi cuenta" back={volver}>
      <form className="flex min-w-0 flex-1 flex-col gap-5" onSubmit={enviar} noValidate aria-busy={cargando || undefined}>
        <LogoBadge />
        <StepBar step={paso} total={3} />
        <p className="-mt-2 text-sm font-semibold text-muted">Paso {paso} de 3</p>

        {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para activar tu cuenta.</Aviso>}

        {paso === 1 && (
          <>
            <Lead>
              Las cuentas de CuidaRed las crea el administrador de cada organización. Escribe el correo con el que te invitaron para activar tu cuenta.
            </Lead>
            <TextField
              label="Correo electrónico"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ejemplo@correo.com"
              value={datos.email}
              error={errores.email}
              help="Es el correo que tu organización registró al invitarte. Si no lo sabes, pregúntale al administrador."
              onChange={(e) => set('email', e.target.value)}
            />
            <TextField
              label="Código de activación"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={datos.codigo}
              error={errores.codigo}
              help="Código de 6 dígitos que te entregó el administrador de tu organización al crear tu cuenta. Es de un solo uso y caduca a los 7 días."
              onChange={(e) => set('codigo', e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            {general && (
              <Aviso tono={general === MENSAJE_SIN_INVITACION ? 'info' : 'error'} icono={general === MENSAJE_SIN_INVITACION ? <MailQuestion size={18} /> : undefined}>
                {general === MENSAJE_SIN_INVITACION ? (
                  <>
                    <strong className="block">No encontramos una invitación pendiente para este correo.</strong>
                    {MENSAJE_SIN_INVITACION} Si ya activaste tu cuenta, inicia sesión.
                  </>
                ) : (
                  general
                )}
              </Aviso>
            )}
          </>
        )}

        {paso === 2 && invitacion && (
          <>
            <Aviso tono="info" icono={<Building2 size={18} />}>
              Invitación de <strong>{invitacion.organizacion}</strong> con el rol <strong>{ROL_LABEL[invitacion.rol]}</strong>. Confirma tus datos.
            </Aviso>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <TextField
                  label="Cédula"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000-0000000-0"
                  maxLength={13}
                  value={datos.cedula}
                  error={errores.cedula}
                  help="Si tu organización registró tu cédula al invitarte, debe coincidir."
                  onChange={(e) => set('cedula', formatCedula(e.target.value))}
                />
              </div>
              <TextField label="Nombre" autoComplete="given-name" value={datos.nombre} error={errores.nombre} onChange={(e) => set('nombre', e.target.value)} />
              <TextField
                label="Apellido"
                autoComplete="family-name"
                value={datos.apellido}
                error={errores.apellido}
                onChange={(e) => set('apellido', e.target.value)}
              />
              <div className="md:col-span-2">
                <TextField
                  label="Teléfono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="000 000 0000"
                  maxLength={12}
                  value={datos.telefono}
                  error={errores.telefono}
                  onChange={(e) => set('telefono', formatTelefono(e.target.value))}
                />
              </div>
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            <Lead>
              Elige una contraseña que solo tú conozcas para <span className="wrap-anywhere font-semibold text-ink">{datos.email.trim().toLowerCase()}</span>.
            </Lead>
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
            <RequisitosPassword id="requisitos-activar" password={password} confirmar={confirmar} />
            <CasillaLegal
              checked={acepto}
              error={errores.acepto}
              onChange={(v) => {
                setAcepto(v)
                recordar({ acepto: v })
                setErrores((x) => ({ ...x, acepto: undefined }))
              }}
            />
            {general && <Aviso tono="error">{general}</Aviso>}
          </>
        )}

        <Acciones>
          <Button type="submit" variant={paso === 3 ? 'primary' : 'light'} fullWidth loading={cargando} disabled={!enLinea}>
            {paso === 3 ? (cargando ? 'Activando…' : 'Activar cuenta') : 'Continuar'}
          </Button>
          <YaTienesCuenta />
        </Acciones>
      </form>
    </AuthScreen>
  )
}
