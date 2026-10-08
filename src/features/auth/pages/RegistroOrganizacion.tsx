import { useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Checkbox, PasswordField, SelectField, StepBar, TextField } from '@/components/ui'
import { HOME_BY_ROL } from '@/domain/auth'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { MUNICIPIOS_POR_PROVINCIA, PROVINCIAS, TIPOS_ORGANIZACION } from '../lib/geo'
import {
  cedulaRegistrada,
  leerBorrador,
  limpiarBorrador,
  limpiarMemoriaCuenta,
  registrarOrganizacion,
  type DatosPersonales,
} from '../lib/registro'
import {
  errorCedula,
  errorConfirmacion,
  errorEmail,
  errorNombre,
  errorPassword,
  errorTelefono,
  formatCedula,
  formatTelefono,
  hayErrores,
} from '../lib/validar'
import a from '../components/Auth.module.css'

type ErroresMap = Record<string, string | undefined>

/**
 * "/registro-organizacion" — Pantalla Registrar org (311:546) y Registrarse organización (332:442).
 *  1) Tipo de organización  2) Datos de la organización  3) Cuenta del administrador.
 *  Si llega desde "Registrarse → Mi organización" ya trae correo, contraseña y datos personales: son solo 2 pasos.
 */
export default function RegistroOrganizacion() {
  const navigate = useNavigate()
  const location = useLocation()
  const cuentaPrevia = (location.state as { cuenta?: { email: string; password: string } } | null)?.cuenta
  const borrador = useMemo(() => leerBorrador(), [])
  const conCuenta = !!(cuentaPrevia && borrador)
  const total = conCuenta ? 2 : 3

  const [paso, setPaso] = useState(1)
  const [errores, setErrores] = useState<ErroresMap>({})
  const [errorGeneral, setErrorGeneral] = useState<string>()

  // Organización
  const [tipo, setTipo] = useState('')
  const [nombreOrg, setNombreOrg] = useState('')
  const [telefonoOrg, setTelefonoOrg] = useState('')
  const [provincia, setProvincia] = useState('')
  const [municipio, setMunicipio] = useState('')

  // Administrador (solo si no viene del registro personal)
  const [cedula, setCedula] = useState(borrador?.cedula ?? '')
  const [nombre, setNombre] = useState(borrador?.nombre ?? '')
  const [apellido, setApellido] = useState(borrador?.apellido ?? '')
  const [telefono, setTelefono] = useState(borrador?.telefono ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [acepto, setAcepto] = useState(false)

  const limpiar = (campo: string) => {
    setErrores((x) => ({ ...x, [campo]: undefined }))
    setErrorGeneral(undefined)
  }

  const salirDelFlujo = () => navigate(conCuenta ? '/registro/cuenta' : '/inicio')
  const volver = () => (paso > 1 ? setPaso(paso - 1) : salirDelFlujo())

  const validarPaso1 = () => ({ tipo: tipo ? undefined : 'Selecciona el tipo de organización.' })
  const validarPaso2 = (): ErroresMap => ({
    nombreOrg: errorNombre(nombreOrg, 'nombre de la organización')?.replace('tu ', 'el '),
    tipo: tipo ? undefined : 'Selecciona el tipo de organización.',
    telefonoOrg: errorTelefono(telefonoOrg)?.replace('tu teléfono', 'el teléfono institucional'),
    provincia: provincia ? undefined : 'Selecciona la provincia.',
    municipio: municipio ? undefined : 'Selecciona el municipio.',
  })
  const validarPaso3 = (): ErroresMap => ({
    cedula: errorCedula(cedula) ?? (cedulaRegistrada(cedula) ? 'Ya existe una cuenta con esta cédula.' : undefined),
    telefono: errorTelefono(telefono),
    nombre: errorNombre(nombre, 'nombre'),
    apellido: errorNombre(apellido, 'apellido'),
    email: errorEmail(email),
    password: errorPassword(password),
    confirmar: errorConfirmacion(password, confirmar),
    acepto: acepto ? undefined : 'Debes aceptar los Términos y la Política de Privacidad.',
  })

  const crear = (datos: DatosPersonales, correo: string, clave: string) => {
    const res = registrarOrganizacion(
      { nombre: nombreOrg, tipo, telefono: telefonoOrg, provincia, municipio },
      datos,
      correo,
      clave,
    )
    if (!res.ok) {
      // Un correo repetido se señala en el campo; en el flujo corto se muestra como aviso general.
      if (!conCuenta && res.error.includes('correo')) {
        setErrores({ email: res.error })
        setPaso(3)
      } else {
        setErrorGeneral(res.error)
      }
      return
    }
    limpiarBorrador()
    limpiarMemoriaCuenta()
    navigate(HOME_BY_ROL.admin, { replace: true })
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()

    if (paso === 1) {
      const v = validarPaso1()
      setErrores(v)
      if (!hayErrores(v)) setPaso(2)
      return
    }

    if (paso === 2) {
      const v = validarPaso2()
      setErrores(v)
      if (hayErrores(v)) return
      if (conCuenta && borrador && cuentaPrevia) return crear(borrador, cuentaPrevia.email, cuentaPrevia.password)
      return setPaso(3)
    }

    const v = validarPaso3()
    setErrores(v)
    if (hayErrores(v)) return
    crear({ cedula, nombre, apellido, telefono }, email, password)
  }

  const municipios = provincia ? (MUNICIPIOS_POR_PROVINCIA[provincia] ?? []) : []
  const ultimoPaso = paso === total

  return (
    <AuthScreen title="Registrar Organización" back={volver}>
      <form className={a.form} onSubmit={enviar} noValidate>
        <LogoBadge />
        <div className={a.steps}>
          <StepBar step={paso} total={total} />
        </div>

        {paso === 1 && (
          <>
            <p className={a.lead}>
              Cuéntanos qué tipo de organización eres. Desde un solo panel podrás gestionar adultos mayores, voluntarios, visitas y alertas.
            </p>
            <SelectField
              label="Tipo de organización"
              placeholder="Seleccionar"
              options={TIPOS_ORGANIZACION}
              value={tipo}
              error={errores.tipo}
              onChange={(e) => {
                setTipo(e.target.value)
                limpiar('tipo')
              }}
            />
          </>
        )}

        {paso === 2 && (
          <>
            <TextField
              label="Nombre de la organización"
              autoComplete="organization"
              placeholder="Nombre"
              value={nombreOrg}
              error={errores.nombreOrg}
              onChange={(e) => {
                setNombreOrg(e.target.value)
                limpiar('nombreOrg')
              }}
            />
            <SelectField
              label="Tipo de organización"
              placeholder="Seleccionar"
              options={TIPOS_ORGANIZACION}
              value={tipo}
              error={errores.tipo}
              onChange={(e) => {
                setTipo(e.target.value)
                limpiar('tipo')
              }}
            />
            <TextField
              label="Teléfono institucional"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="000 000 0000"
              maxLength={12}
              value={telefonoOrg}
              error={errores.telefonoOrg}
              onChange={(e) => {
                setTelefonoOrg(formatTelefono(e.target.value))
                limpiar('telefonoOrg')
              }}
            />
            <div className={a.grid2}>
              <SelectField
                label="Provincia"
                placeholder="Seleccionar"
                options={PROVINCIAS}
                value={provincia}
                error={errores.provincia}
                onChange={(e) => {
                  setProvincia(e.target.value)
                  setMunicipio('')
                  limpiar('provincia')
                }}
              />
              <SelectField
                label="Municipio"
                placeholder={provincia ? 'Seleccionar' : 'Elige primero la provincia'}
                options={municipios}
                value={municipio}
                disabled={!provincia}
                error={errores.municipio}
                onChange={(e) => {
                  setMunicipio(e.target.value)
                  limpiar('municipio')
                }}
              />
            </div>
          </>
        )}

        {paso === 3 && (
          <>
            <p className={a.lead}>Crea la cuenta de administrador de {nombreOrg.trim() || 'tu organización'}.</p>
            <div className={a.grid2}>
              <div className={a.span2}>
                <TextField
                  label="Cédula"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000-0000000-0"
                  maxLength={13}
                  value={cedula}
                  error={errores.cedula}
                  onChange={(e) => {
                    setCedula(formatCedula(e.target.value))
                    limpiar('cedula')
                  }}
                />
              </div>
              <TextField
                label="Nombre"
                autoComplete="given-name"
                placeholder="Nombre"
                value={nombre}
                error={errores.nombre}
                onChange={(e) => {
                  setNombre(e.target.value)
                  limpiar('nombre')
                }}
              />
              <TextField
                label="Apellido"
                autoComplete="family-name"
                placeholder="Apellido"
                value={apellido}
                error={errores.apellido}
                onChange={(e) => {
                  setApellido(e.target.value)
                  limpiar('apellido')
                }}
              />
              <div className={a.span2}>
                <TextField
                  label="Teléfono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="000 000 0000"
                  maxLength={12}
                  value={telefono}
                  error={errores.telefono}
                  onChange={(e) => {
                    setTelefono(formatTelefono(e.target.value))
                    limpiar('telefono')
                  }}
                />
              </div>
              <div className={a.span2}>
                <TextField
                  label="Correo electrónico"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  error={errores.email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    limpiar('email')
                  }}
                />
              </div>
              <div className={a.span2}>
                <PasswordField
                  label="Contraseña"
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  error={errores.password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    limpiar('password')
                  }}
                />
              </div>
              <div className={a.span2}>
                <PasswordField
                  label="Confirmar contraseña"
                  autoComplete="new-password"
                  placeholder="Repite la contraseña"
                  value={confirmar}
                  error={errores.confirmar}
                  onChange={(e) => {
                    setConfirmar(e.target.value)
                    limpiar('confirmar')
                  }}
                />
              </div>
            </div>
            <div>
              <Checkbox
                checked={acepto}
                onChange={(e) => {
                  setAcepto(e.target.checked)
                  limpiar('acepto')
                }}
                label={
                  <>
                    Acepto los{' '}
                    <Link to="/terminos" className={a.legal}>
                      Términos y Condiciones
                    </Link>{' '}
                    y la{' '}
                    <Link to="/privacidad" className={a.legal}>
                      Política de Privacidad
                    </Link>{' '}
                    de CuidaRed.
                  </>
                }
              />
              {errores.acepto && (
                <p className={a.alert} role="alert" style={{ marginTop: 10 }}>
                  {errores.acepto}
                </p>
              )}
            </div>
          </>
        )}

        {errorGeneral && (
          <p className={a.alert} role="alert">
            {errorGeneral}
          </p>
        )}

        <div className={a.actions}>
          {ultimoPaso ? (
            <>
              <Button type="submit" fullWidth>
                Guardar organización
              </Button>
              <Button variant="light" fullWidth onClick={salirDelFlujo}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" variant="light" fullWidth>
                Siguiente
              </Button>
              <Button variant="ghost" fullWidth onClick={salirDelFlujo}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </form>
    </AuthScreen>
  )
}
