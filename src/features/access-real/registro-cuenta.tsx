/*
 * registro-cuenta.tsx — Autorregistro del titular: crea la persona con Supabase Auth y luego su cuenta Familia u
 * Organización con prueba gratuita.
 * Módulo: access-real (fase 2 · RF-11, decisión del equipo 2026-11-06).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Pasos: 1 tipo de cuenta · 2 datos de la persona · 3 contraseña · 4 código del correo · 5 datos de la cuenta.
 * `signUp` lleva cédula, nombres y apellidos en `options.data` porque el trigger del backend crea el perfil con ellos;
 * la sesión del código vive en un cliente temporal y solo al crear la cuenta se pasa al cliente principal (igual que la
 * activación de una invitación). Quien ya tiene sesión salta los pasos de persona: solo elige tipo y datos de la cuenta.
 * Cada pantalla tiene como máximo 5 campos de texto, valida junto al campo y conserva lo escrito ante cualquier error.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AuthError, Session } from '@supabase/supabase-js'
import { Button, ButtonLink, Checkbox, PasswordField, SelectField, StepBar, TextField } from '@/components/ui'
import { DIAS_PRUEBA_GRATUITA } from '@/domain/planes'
import { cn } from '@/lib/cn'
import { AuthScreen } from '../auth/components/AuthScreen'
import { LogoBadge } from '../auth/components/LogoBadge'
import { Aviso, ENLACE, RequisitosPassword } from '../auth/components/Piezas'
import { crearCuenta } from './api/cuentas'
import {
  listarCategoriasCuenta,
  listarMunicipios,
  listarProvincias,
  type CategoriaCuenta,
  type Municipio,
  type Provincia,
} from './api/catalogos'
import { ApiError, getClient, passwordError, temporaryClient, type CuentaMe, type TipoCuenta } from './client'
import { TIPO_TEXTO } from './cuentas-datos'
import { mensajeDeError } from './errores'

type Paso = 'tipo' | 'datos' | 'clave' | 'codigo' | 'cuenta'
type Errores = Record<string, string | undefined>
type Fallo = { tipo: 'texto'; texto: string } | { tipo: 'deshabilitado' } | { tipo: 'existente' } | { tipo: 'sesion' }

const PASOS_COMPLETOS: Paso[] = ['tipo', 'datos', 'clave', 'codigo', 'cuenta']
const PASOS_CON_SESION: Paso[] = ['tipo', 'cuenta']
const TITULO_PASO: Record<Paso, string> = {
  tipo: '¿Para quién vas a usar CuidaRed?',
  datos: 'Tus datos personales',
  clave: 'Crea tu contraseña',
  codigo: 'Confirma tu correo',
  cuenta: 'Datos de la cuenta',
}

const DESCRIPCION_TIPO: Record<TipoCuenta, string> = {
  familia:
    'Para quien cuida a un familiar mayor. Serás la persona coordinadora: invitas a cuidadores y familiares y decides quién ve cada perfil.',
  organizacion:
    'Para iglesias, fundaciones, asilos o universidades. Serás la persona administradora: invitas a coordinadores, cuidadores, voluntarios y familiares.',
}

const normalizaCorreo = (correo: string) => correo.trim().toLowerCase()
const correoValido = (correo: string) => correo.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)
/** Mismo criterio que el servidor: sin espacios ni guiones, con "+" opcional y de 10 a 15 dígitos. */
const normalizaTelefono = (telefono: string) => telefono.replace(/[\s-]/g, '')

/** Traduce el error de Supabase Auth al registrarse; nunca muestra el texto del proveedor. */
function fallaDeRegistro(issue: AuthError): Fallo {
  const codigo = issue.code
  const texto = (valor: string): Fallo => ({ tipo: 'texto', texto: valor })
  if (
    codigo === 'signup_disabled' ||
    codigo === 'email_provider_disabled' ||
    /signups? not allowed|signups? (are )?disabled|email (logins|signups) (are )?disabled/i.test(issue.message)
  ) {
    return { tipo: 'deshabilitado' }
  }
  if (codigo === 'user_already_exists' || codigo === 'email_exists') return { tipo: 'existente' }
  if (codigo === 'weak_password') return texto('La contraseña no cumple los requisitos de seguridad. Elige otra más robusta.')
  if (issue.status === 429 || codigo === 'over_email_send_rate_limit' || codigo === 'over_request_rate_limit') {
    return texto('Se hicieron demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.')
  }
  if (codigo === 'email_address_invalid' || codigo === 'validation_failed') return texto('Revisa el correo electrónico: no se pudo usar para crear la cuenta.')
  if (!issue.status || issue.status >= 500) return texto('No se pudo conectar con CuidaRed. Intenta de nuevo.')
  return texto('No se pudo crear la cuenta con esos datos. Revisa la información e intenta de nuevo.')
}

function AvisoFallo({ fallo }: { fallo: Fallo }) {
  if (fallo.tipo === 'deshabilitado') {
    return (
      <Aviso tono="error">
        El registro de cuentas todavía no está habilitado. Si recibiste una invitación,{' '}
        <Link to="/registro" className={ENLACE}>
          actívala aquí
        </Link>
        .
      </Aviso>
    )
  }
  if (fallo.tipo === 'existente') {
    // Respuesta genérica: no confirma si el correo ya tiene cuenta (evita enumerar personas registradas).
    return (
      <Aviso tono="error">
        No se pudo crear la cuenta con esos datos. Si ya tienes una cuenta,{' '}
        <Link to="/inicio" className={ENLACE}>
          inicia sesión
        </Link>{' '}
        o{' '}
        <Link to="/recuperar" className={ENLACE}>
          recupera tu contraseña
        </Link>
        .
      </Aviso>
    )
  }
  if (fallo.tipo === 'sesion') {
    return (
      <Aviso tono="error">
        Tu cuenta se creó, pero no se pudo abrir la sesión.{' '}
        <Link to="/inicio" className={ENLACE}>
          Inicia sesión
        </Link>{' '}
        con tu correo y tu contraseña.
      </Aviso>
    )
  }
  return <Aviso tono="error">{fallo.texto}</Aviso>
}

interface Props {
  /** Título de la pantalla (cambia según la ruta de entrada). */
  titulo: string
  /** Rutas /registro-familia y /registro-organizacion llegan con el tipo ya elegido. */
  tipoInicial?: TipoCuenta
  /** Sesión del cliente principal: si existe, la persona ya está registrada y solo crea la cuenta. */
  session: Session | null
  /** Se llama con la cuenta creada, antes de ir a /cuenta, para que la pantalla de cuenta la seleccione y se actualice. */
  onCreada: (cuenta: CuentaMe) => void
}

export function RegistroCuenta({ titulo, tipoInicial, session, onCreada }: Props) {
  const navigate = useNavigate()
  const [conSesionPrevia] = useState(() => !!session)
  const pasos = conSesionPrevia ? PASOS_CON_SESION : PASOS_COMPLETOS
  const [temporal] = useState(temporaryClient)
  const [sesionTemporal, setSesionTemporal] = useState<Session | null>(null)
  const [paso, setPaso] = useState<Paso>(tipoInicial ? (conSesionPrevia ? 'cuenta' : 'datos') : 'tipo')
  const [tipo, setTipo] = useState<TipoCuenta | ''>(tipoInicial ?? '')
  const [persona, setPersona] = useState({ cedula: '', nombres: '', apellidos: '', correo: '' })
  const [clave, setClave] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [cuenta, setCuenta] = useState({ nombre: '', categoria: '', provincia: '', municipio: '', direccion: '', telefono: '' })
  const [errores, setErrores] = useState<Errores>({})
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [creada, setCreada] = useState<CuentaMe | null>(null)
  const encabezadoPaso = useRef<HTMLHeadingElement>(null)
  const formulario = useRef<HTMLFormElement>(null)

  // Catálogos del último paso; se piden con la sesión que ya existe (la del código o la que ya tenía la persona).
  const token = conSesionPrevia ? (session?.access_token ?? null) : (sesionTemporal?.access_token ?? null)
  const [categorias, setCategorias] = useState<CategoriaCuenta[]>([])
  const [provincias, setProvincias] = useState<Provincia[]>([])
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [errorCatalogos, setErrorCatalogos] = useState('')
  const [errorMunicipios, setErrorMunicipios] = useState('')
  const [intentoCatalogos, setIntentoCatalogos] = useState(0)
  const [intentoMunicipios, setIntentoMunicipios] = useState(0)
  // "Cargando" se deriva de qué consulta terminó, sin cambiar estados al empezar el efecto.
  const consultaCatalogos = `${tipo}|${token}|${intentoCatalogos}`
  const [consultaTerminada, setConsultaTerminada] = useState('')
  const [consultaMunicipiosTerminada, setConsultaMunicipiosTerminada] = useState('')
  const cargandoCatalogos = paso === 'cuenta' && !!tipo && !!token && consultaTerminada !== consultaCatalogos
  const consultaMunicipios = `${cuenta.provincia}|${token}|${intentoMunicipios}`
  const cargandoMunicipios = paso === 'cuenta' && !!cuenta.provincia && !!token && consultaMunicipios !== consultaMunicipiosTerminada

  useEffect(() => {
    encabezadoPaso.current?.focus()
  }, [paso])

  useEffect(() => {
    if (paso !== 'cuenta' || !tipo || !token) return
    let vigente = true
    Promise.all([listarCategoriasCuenta(token, tipo), listarProvincias(token)])
      .then(([cats, provs]) => {
        if (!vigente) return
        setCategorias(cats)
        setProvincias(provs)
        setErrorCatalogos('')
      })
      .catch((issue) => vigente && setErrorCatalogos(mensajeDeError(issue)))
      .finally(() => vigente && setConsultaTerminada(`${tipo}|${token}|${intentoCatalogos}`))
    return () => {
      vigente = false
    }
  }, [paso, tipo, token, intentoCatalogos])

  useEffect(() => {
    if (paso !== 'cuenta' || !token || !cuenta.provincia) return
    let vigente = true
    listarMunicipios(token, cuenta.provincia)
      .then((lista) => {
        if (!vigente) return
        setMunicipios(lista)
        setErrorMunicipios('')
      })
      .catch((issue) => vigente && setErrorMunicipios(mensajeDeError(issue)))
      .finally(() => vigente && setConsultaMunicipiosTerminada(consultaMunicipios))
    return () => {
      vigente = false
    }
  }, [paso, token, cuenta.provincia, consultaMunicipios])

  const limpiar = () => {
    setErrores({})
    setFallo(null)
    setAviso('')
  }
  const irA = (destino: Paso) => {
    limpiar()
    setPaso(destino)
  }
  const siguienteDeTipo = (): Paso => (conSesionPrevia || sesionTemporal ? 'cuenta' : 'datos')
  const atras = () => {
    if (paso === 'tipo') return navigate(conSesionPrevia ? '/cuenta' : '/')
    // Con el correo ya verificado no tiene sentido volver a pedir la persona: desde la cuenta se vuelve al tipo.
    // Desde el código se vuelve a los datos para corregir el correo si hizo falta.
    irA(paso === 'datos' || paso === 'cuenta' ? 'tipo' : 'datos')
  }

  const cambiarPersona = (campo: keyof typeof persona, valor: string) => {
    setPersona((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
  }
  const cambiarCuenta = (campo: keyof typeof cuenta, valor: string) => {
    setCuenta((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
  }

  /* ───────────── Pasos ───────────── */

  const validarDatos = (): Errores => ({
    cedula: /^\d{11}$/.test(persona.cedula) ? undefined : 'La cédula debe tener exactamente 11 dígitos.',
    nombres: persona.nombres.trim() ? undefined : 'Escribe tus nombres.',
    apellidos: persona.apellidos.trim() ? undefined : 'Escribe tus apellidos.',
    correo: correoValido(normalizaCorreo(persona.correo)) ? undefined : 'Escribe un correo válido, por ejemplo nombre@correo.com.',
  })

  const validarClave = (): Errores => ({
    clave: passwordError(clave),
    confirmar: confirmar === clave ? undefined : 'Las contraseñas no coinciden.',
    acepta: acepta ? undefined : 'Debes aceptar los Términos y la Política de privacidad para crear tu cuenta.',
  })

  const validarCuenta = (): Errores => {
    const telefono = normalizaTelefono(cuenta.telefono)
    return {
      nombre: cuenta.nombre.trim().length < 2 || cuenta.nombre.trim().length > 120 ? 'El nombre debe tener entre 2 y 120 caracteres.' : undefined,
      categoria: cuenta.categoria ? undefined : 'Elige la categoría de la cuenta.',
      provincia: cuenta.provincia ? undefined : 'Elige la provincia.',
      municipio: cuenta.municipio ? undefined : 'Elige el municipio.',
      direccion: cuenta.direccion.trim().length > 150 ? 'La dirección admite hasta 150 caracteres.' : undefined,
      telefono: telefono && !/^\+?[0-9]{10,15}$/.test(telefono) ? 'Escribe un teléfono de 10 a 15 dígitos, por ejemplo 809-555-1234.' : undefined,
    }
  }

  const hayErrores = (valores: Errores) => Object.values(valores).some(Boolean)
  const enfocarError = (valores: Errores) => {
    const campo = Object.keys(valores).find((nombre) => valores[nombre])
    if (campo) formulario.current?.querySelector<HTMLElement>('#registro-' + campo)?.focus()
  }

  const registrarPersona = async () => {
    const { data, error } = await temporal.auth.signUp({
      email: normalizaCorreo(persona.correo),
      password: clave,
      options: { data: { cedula: persona.cedula, nombres: persona.nombres.trim(), apellidos: persona.apellidos.trim() } },
    })
    if (error) {
      setFallo(fallaDeRegistro(error))
      return
    }
    // Con el correo ya registrado, Supabase puede responder sin error y sin identidades: se trata igual, de forma genérica.
    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      setFallo({ tipo: 'existente' })
      return
    }
    setClave('')
    setConfirmar('')
    if (data.session) {
      // Proyecto sin confirmación de correo: ya hay sesión y no hay código que verificar.
      setSesionTemporal(data.session)
      irA('cuenta')
      return
    }
    irA('codigo')
  }

  const verificarCodigo = async () => {
    const problema = /^\d{6}$/.test(codigo) ? undefined : 'Escribe los 6 dígitos del código que llegó a tu correo.'
    if (problema) {
      setErrores({ codigo: problema })
      enfocarError({ codigo: problema })
      return
    }
    const resultado = await temporal.auth.verifyOtp({ email: normalizaCorreo(persona.correo), token: codigo, type: 'signup' })
    if (resultado.error || !resultado.data.session) {
      setErrores({ codigo: 'El código no es válido o ha vencido. Revisa tu correo o pide uno nuevo.' })
      return
    }
    setSesionTemporal(resultado.data.session)
    setCodigo('')
    irA('cuenta')
  }

  const reenviarCodigo = async () => {
    if (ocupado) return
    setOcupado(true)
    limpiar()
    try {
      const { error } = await temporal.auth.resend({ type: 'signup', email: normalizaCorreo(persona.correo) })
      if (error) setFallo(fallaDeRegistro(error))
      else setAviso('Te enviamos un código nuevo. Revisa tu correo (y la carpeta de no deseados).')
    } catch {
      setFallo({ tipo: 'texto', texto: 'No se pudo enviar el código. Intenta de nuevo.' })
    } finally {
      setOcupado(false)
    }
  }

  /** Crea la cuenta y, si la sesión era la del código, la pasa al cliente principal antes de ir a /cuenta. */
  const registrarCuenta = async () => {
    const validos = validarCuenta()
    if (hayErrores(validos)) {
      setErrores(validos)
      enfocarError(validos)
      return
    }
    if (!token || !tipo) {
      setFallo({ tipo: 'texto', texto: 'Tu sesión venció. Inicia sesión de nuevo para continuar.' })
      return
    }
    let nueva = creada
    if (!nueva) {
      const direccion = cuenta.direccion.trim()
      const telefono = normalizaTelefono(cuenta.telefono)
      try {
        nueva = await crearCuenta(token, {
          tipo,
          nombre: cuenta.nombre.trim(),
          categoria_cuenta_id: Number(cuenta.categoria),
          municipio_cod: cuenta.municipio,
          ...(direccion ? { direccion } : {}),
          ...(telefono ? { telefono } : {}),
        })
      } catch (issue) {
        if (issue instanceof ApiError && issue.code === 'INVALID_CATEGORY') setErrores({ categoria: mensajeDeError(issue) })
        else setFallo({ tipo: 'texto', texto: mensajeDeError(issue) })
        return
      }
      setCreada(nueva)
    }
    if (!conSesionPrevia) {
      const { data } = await temporal.auth.getSession()
      if (!data.session) {
        setFallo({ tipo: 'sesion' })
        return
      }
      const abierta = await getClient().auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
      if (abierta.error) {
        setFallo({ tipo: 'sesion' })
        return
      }
    }
    onCreada(nueva)
    navigate('/cuenta', { replace: true })
  }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (ocupado) return
    limpiar()
    setOcupado(true)
    try {
      if (paso === 'tipo') {
        if (!tipo) {
          setErrores({ tipo: 'Elige el tipo de cuenta para continuar.' })
          enfocarError({ tipo: 'Elige el tipo de cuenta para continuar.' })
        }
        else irA(siguienteDeTipo())
      } else if (paso === 'datos') {
        const validos = validarDatos()
        if (hayErrores(validos)) { setErrores(validos); enfocarError(validos) }
        else irA('clave')
      } else if (paso === 'clave') {
        const validos = validarClave()
        if (hayErrores(validos)) { setErrores(validos); enfocarError(validos) }
        else await registrarPersona()
      } else if (paso === 'codigo') await verificarCodigo()
      else await registrarCuenta()
    } catch (issue) {
      setFallo({ tipo: 'texto', texto: issue instanceof ApiError ? mensajeDeError(issue) : 'No se pudo completar el paso. Intenta de nuevo.' })
    } finally {
      setOcupado(false)
    }
  }

  /* ───────────── Presentación ───────────── */

  const etiquetaNombre = tipo === 'organizacion' ? 'Nombre de la organización' : 'Nombre de la familia'
  const municipiosDeLaProvincia = municipios.filter((m) => m.provincia_cod === cuenta.provincia)
  let contenido: ReactNode = null
  if (paso === 'tipo') {
    contenido = (
      <>
        <fieldset aria-describedby={errores.tipo ? 'registro-tipo-error' : undefined} className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Tipo de cuenta</legend>
          {(['familia', 'organizacion'] as const).map((opcion) => (
            <label key={opcion} className={cn(
              'relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border px-2 py-3 text-center font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue',
              tipo === opcion ? 'border-navy bg-blue-100 text-navy' : 'border-line bg-surface text-ink-2 hover:border-navy',
            )}>
              <input
                id={opcion === 'familia' ? 'registro-tipo' : 'registro-tipo-organizacion'}
                type="radio"
                name="tipo-cuenta"
                className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
                checked={tipo === opcion}
                onChange={() => {
                  if (opcion !== tipo) setCuenta((actual) => ({ ...actual, categoria: '' }))
                  setTipo(opcion)
                  setErrores({})
                }}
              />
              <img src={'/figma-miembros/' + opcion + '.svg'} alt="" width={opcion === 'familia' ? 31 : 34} height={opcion === 'familia' ? 31 : 35} />
              {TIPO_TEXTO[opcion]}
            </label>
          ))}
          {errores.tipo && <p id="registro-tipo-error" className="col-span-2 text-sm font-semibold text-danger" role="alert">{errores.tipo}</p>}
        </fieldset>
        {tipo && <p className="rounded-sm border border-line-soft bg-surface px-3.5 py-3 text-sm leading-snug text-ink-2">{DESCRIPCION_TIPO[tipo]}</p>}
        <Aviso tono="info">Incluye {DIAS_PRUEBA_GRATUITA} días de prueba gratuita, sin tarjeta.</Aviso>
        {!conSesionPrevia && !sesionTemporal && (
          <p className="text-center text-sm text-ink-2">
            ¿Te invitaron a una cuenta? <Link to="/registro" className={ENLACE}>Activa tu invitación</Link>.
          </p>
        )}
      </>
    )
  } else if (paso === 'datos') {
    contenido = (
      <>
        <TextField
          id="registro-cedula"
          label="Cédula"
          required
          inputMode="numeric"
          placeholder="00000000000"
          autoComplete="off"
          value={persona.cedula}
          error={errores.cedula}
          hint="11 dígitos, sin guiones."
          onChange={(e) => cambiarPersona('cedula', e.target.value.replace(/\D/g, '').slice(0, 11))}
        />
        <TextField
          id="registro-nombres"
          label="Nombres"
          required
          maxLength={100}
          autoComplete="given-name"
          value={persona.nombres}
          error={errores.nombres}
          onChange={(e) => cambiarPersona('nombres', e.target.value)}
        />
        <TextField
          id="registro-apellidos"
          label="Apellidos"
          required
          maxLength={100}
          autoComplete="family-name"
          value={persona.apellidos}
          error={errores.apellidos}
          onChange={(e) => cambiarPersona('apellidos', e.target.value)}
        />
        <TextField
          id="registro-correo"
          label="Correo electrónico"
          type="email"
          placeholder="nombre@correo.com"
          required
          maxLength={254}
          autoComplete="email"
          value={persona.correo}
          error={errores.correo}
          hint="Te enviaremos un código de verificación."
          onChange={(e) => cambiarPersona('correo', e.target.value)}
        />
      </>
    )
  } else if (paso === 'clave') {
    contenido = (
      <>
        <PasswordField
          id="registro-clave"
          label="Contraseña"
          required
          autoComplete="new-password"
          value={clave}
          error={errores.clave}
          onChange={(e) => {
            setClave(e.target.value)
            setErrores((actuales) => ({ ...actuales, clave: undefined }))
          }}
        />
        <PasswordField
          id="registro-confirmar"
          label="Confirmar contraseña"
          required
          autoComplete="new-password"
          value={confirmar}
          error={errores.confirmar}
          onChange={(e) => {
            setConfirmar(e.target.value)
            setErrores((actuales) => ({ ...actuales, confirmar: undefined }))
          }}
        />
        <RequisitosPassword password={clave} confirmar={confirmar} />
        <Checkbox
          id="registro-acepta"
          checked={acepta}
          error={errores.acepta}
          onChange={(e) => {
            setAcepta(e.target.checked)
            setErrores((actuales) => ({ ...actuales, acepta: undefined }))
          }}
          label={
            <>
              Acepto los{' '}
              <Link className="inline-flex min-h-12 items-center" target="_blank" rel="noopener" to="/terminos">
                Términos
              </Link>{' '}
              y la{' '}
              <Link className="inline-flex min-h-12 items-center" target="_blank" rel="noopener" to="/privacidad">
                Política de privacidad
              </Link>
              .
            </>
          }
        />
      </>
    )
  } else if (paso === 'codigo') {
    contenido = (
      <>
        <p className="text-ink-2">
          Te enviamos un código de verificación a <strong className="break-all">{normalizaCorreo(persona.correo)}</strong>. Escríbelo para confirmar tu correo.
        </p>
        <TextField
          id="registro-codigo"
          label="Código de verificación"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          error={errores.codigo}
          hint="6 dígitos. Caduca a los 15 minutos."
          onChange={(e) => {
            setCodigo(e.target.value.replace(/\D/g, ''))
            setErrores({})
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={ocupado} onClick={() => void reenviarCodigo()}>Reenviar código</Button>
          <Button variant="ghost" disabled={ocupado} onClick={atras}>Cambiar correo</Button>
        </div>
      </>
    )
  } else {
    contenido = (
      <>
        {!conSesionPrevia && sesionTemporal && (
          <Aviso tono="info">Tu correo ya está verificado. Completa estos datos para crear una cuenta a tu cargo o <Link to="/inicio" className={ENLACE}>inicia sesión</Link> para aceptar una invitación existente.</Aviso>
        )}
        {errorCatalogos && (
          <Aviso tono="error">
            <p>{errorCatalogos}</p>
            <Button
              variant="ghost"
              className="-ml-4"
              onClick={() => {
                setErrorCatalogos('')
                setIntentoCatalogos((n) => n + 1)
              }}
            >
              Reintentar
            </Button>
          </Aviso>
        )}
        <TextField
          id="registro-nombre"
          label={etiquetaNombre}
          required
          maxLength={120}
          autoComplete="organization"
          value={cuenta.nombre}
          error={errores.nombre}
          hint={tipo === 'organizacion' ? 'Por ejemplo: Fundación Esperanza.' : 'Por ejemplo: Familia Pérez.'}
          onChange={(e) => cambiarCuenta('nombre', e.target.value)}
        />
        <SelectField
          id="registro-categoria"
          label={tipo === 'organizacion' ? 'Tipo de organización' : 'Categoría'}
          required
          disabled={cargandoCatalogos || !!errorCatalogos}
          placeholder={cargandoCatalogos ? 'Cargando categorías…' : 'Elige una categoría'}
          options={categorias.map((c) => ({ value: String(c.categoria_cuenta_id), label: c.nombre }))}
          value={cuenta.categoria}
          error={errores.categoria}
          onChange={(e) => cambiarCuenta('categoria', e.target.value)}
        />
        <TextField
          id="registro-telefono"
          label={tipo === 'organizacion' ? 'Teléfono institucional (opcional)' : 'Teléfono (opcional)'}
          type="tel"
          maxLength={20}
          autoComplete="tel"
          placeholder="809 555 1234"
          value={cuenta.telefono}
          error={errores.telefono}
          onChange={(e) => cambiarCuenta('telefono', e.target.value)}
        />
        <SelectField
          id="registro-provincia"
          label="Provincia"
          required
          disabled={cargandoCatalogos || !!errorCatalogos}
          placeholder={cargandoCatalogos ? 'Cargando provincias…' : 'Elige una provincia'}
          options={provincias.map((p) => ({ value: p.provincia_cod, label: p.nombre }))}
          value={cuenta.provincia}
          error={errores.provincia}
          onChange={(e) => {
            setMunicipios([])
            setErrorMunicipios('')
            setConsultaMunicipiosTerminada('')
            setCuenta((actual) => ({ ...actual, provincia: e.target.value, municipio: '' }))
            setErrores((actuales) => ({ ...actuales, provincia: undefined, municipio: undefined }))
          }}
        />
        <SelectField
          id="registro-municipio"
          label="Municipio"
          required
          disabled={!cuenta.provincia || cargandoMunicipios || !!errorMunicipios}
          placeholder={!cuenta.provincia ? 'Elige primero la provincia' : cargandoMunicipios ? 'Cargando municipios…' : 'Elige un municipio'}
          options={municipiosDeLaProvincia.map((m) => ({ value: m.municipio_cod, label: m.nombre }))}
          value={cuenta.municipio}
          error={errores.municipio}
          onChange={(e) => cambiarCuenta('municipio', e.target.value)}
        />
        {errorMunicipios && (
          <Aviso tono="error">
            <p>{errorMunicipios}</p>
            <Button variant="ghost" onClick={() => {
              setErrorMunicipios('')
              setIntentoMunicipios((n) => n + 1)
            }}>Reintentar municipios</Button>
          </Aviso>
        )}
        <TextField
          id="registro-direccion"
          label="Dirección (opcional)"
          maxLength={150}
          autoComplete="street-address"
          value={cuenta.direccion}
          error={errores.direccion}
          onChange={(e) => cambiarCuenta('direccion', e.target.value)}
        />
      </>
    )
  }

  return (
    <AuthScreen title={titulo} back={atras}>
      <LogoBadge />
      <StepBar step={pasos.indexOf(paso) + 1} total={pasos.length} />
      <form ref={formulario} className="mt-6 flex flex-col gap-5" onSubmit={(e) => void enviar(e)} noValidate>
        <h2 ref={encabezadoPaso} tabIndex={-1} className="text-lg font-bold text-ink outline-none">{TITULO_PASO[paso]}</h2>
        {contenido}
        {aviso && <Aviso tono="info">{aviso}</Aviso>}
        {fallo && <AvisoFallo fallo={fallo} />}
        <Button type="submit" variant={paso === 'tipo' || paso === 'datos' ? 'outline' : 'primary'} loading={ocupado} disabled={paso === 'cuenta' && (cargandoCatalogos || !!errorCatalogos || cargandoMunicipios || !!errorMunicipios)}>
          {paso === 'cuenta' ? (tipo === 'organizacion' ? 'Guardar organización' : 'Crear cuenta') : paso === 'clave' ? 'Registrarme' : paso === 'codigo' ? 'Verificar correo' : 'Continuar'}
        </Button>
        {paso === 'cuenta' && conSesionPrevia ? (
          <ButtonLink to="/cuenta" variant="outline">Cancelar</ButtonLink>
        ) : paso === 'datos' || paso === 'clave' ? (
          <Button variant="ghost" disabled={ocupado} onClick={atras}>
            Volver
          </Button>
        ) : null}
      </form>
    </AuthScreen>
  )
}
