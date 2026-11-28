/*
 * perfil-cuenta.tsx — «Mi perfil» (/cuenta), rediseño del Figma 04 a 06: perfil en solo lectura, «Editar mis datos» y
 * «Cambiar contraseña», con las cuentas, invitaciones y el resumen de la cuenta activa que ya existían.
 * Las tres vistas viven en la misma ruta (la vista va en el estado del historial, no en la URL), así «Volver» y el botón
 * Atrás del navegador regresan a la vista anterior.
 * Módulo: access-real.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Aviso, Button, FilaLista, Icono, PasswordField, RequisitosContrasena, TextField, type NombreIcono } from '@/components/ui'
import { cn } from '@/lib/cn'
import { PaginaSecundaria } from './operacion/marco/pagina-secundaria'
import { iniciales } from './operacion/marco/modulos'
import { api, passwordError, temporaryClient, type CuentaMe, type CurrentUser } from './client'
import { ROL_TEXTO } from './cuentas-datos'

type Vista = 'ver' | 'editar' | 'contrasena'
const TITULOS: Record<Vista, string> = { ver: 'Mi perfil', editar: 'Editar mis datos', contrasena: 'Cambiar contraseña' }

const mensaje = (error: unknown) => (error instanceof Error ? error.message : 'No se pudo completar la operación. Intenta de nuevo.')
const TARJETA = 'overflow-hidden rounded-md border border-surface-2 bg-surface shadow-1'

/** 00112345678 → 001-1234567-8 (si no tiene 11 dígitos se muestra tal cual). */
const formatearCedula = (cedula: string) => (/^\d{11}$/.test(cedula) ? `${cedula.slice(0, 3)}-${cedula.slice(3, 10)}-${cedula.slice(10)}` : cedula)
/** 8095550142 → 809 555 0142. */
const formatearTelefono = (telefono: string) => (/^\d{10}$/.test(telefono) ? `${telefono.slice(0, 3)} ${telefono.slice(3, 6)} ${telefono.slice(6)}` : telefono)

/* ───────────── Cabecera: avatar, nombre, rol y cuenta ───────────── */

function CabeceraPerfil({ perfil, cuenta, children }: { perfil: CurrentUser['profile']; cuenta?: CuentaMe; children?: ReactNode }) {
  const nombre = `${perfil.nombres} ${perfil.apellidos}`.trim()
  return <div className="grid justify-items-center gap-2 text-center">
    <span aria-hidden className="grid size-24 place-items-center rounded-full border-[3px] border-blue bg-blue-100 text-pantalla text-navy">{iniciales(nombre)}</span>
    <h2 className="max-w-full text-pantalla text-ink wrap-anywhere">{nombre}</h2>
    {cuenta && <>
      <span className="rounded-pill border border-navy bg-blue-100 px-3 py-1 text-etiqueta text-navy uppercase">
        {ROL_TEXTO[cuenta.rol]}{cuenta.es_titular ? ' · Titular' : ''}
      </span>
      <p className="max-w-full text-ayuda text-muted wrap-anywhere">{cuenta.nombre}</p>
    </>}
    {children}
  </div>
}

function FilaDato({ icono, etiqueta, valor }: { icono: NombreIcono; etiqueta: string; valor: string }) {
  return <div className="flex min-h-16 items-center gap-3 px-3 py-3">
    <span aria-hidden className="grid size-10 flex-none place-items-center rounded-md bg-blue-100 text-navy"><Icono nombre={icono} /></span>
    <div className="grid min-w-0 flex-1">
      <dt className="text-ayuda text-muted">{etiqueta}</dt>
      <dd className="text-cuerpo font-semibold text-ink wrap-anywhere">{valor}</dd>
    </div>
  </div>
}

/* ───────────── Editar mis datos ───────────── */

/** Edición de nombre, apellidos y teléfono (PATCH /me). El correo y la cédula se muestran sin poder cambiarse. */
export function FormularioPerfil({ token, perfil, alGuardar, alCancelar }: {
  token: string
  perfil: CurrentUser['profile']
  alGuardar: () => void
  alCancelar: () => void
}) {
  const [datos, setDatos] = useState({ nombres: perfil.nombres, apellidos: perfil.apellidos, telefono: perfil.telefono ?? '' })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    if (ocupado) return
    setOcupado(true)
    setError('')
    try {
      await api('/me', token, 'PATCH', { nombres: datos.nombres, apellidos: datos.apellidos, telefono: datos.telefono.trim() || null })
      alGuardar()
    } catch (issue) {
      setError(mensaje(issue))
    } finally {
      setOcupado(false)
    }
  }
  return <form className="grid gap-5" onSubmit={enviar}>
    <p className="text-cuerpo text-ink">Actualiza tu nombre y tu teléfono. El correo y la cédula no se pueden cambiar desde aquí.</p>
    <TextField label="Correo electrónico" type="email" readOnly value={perfil.correo} className="bg-surface-2 text-ink-2" hint="Para cambiarlo, contacta a soporte." />
    <TextField label="Cédula" inputMode="numeric" readOnly value={formatearCedula(perfil.cedula)} className="bg-surface-2 text-ink-2"
      hint="Registrada al invitarte; para corregirla contacta a la persona responsable." />
    <TextField label="Nombres" required maxLength={100} autoComplete="given-name" value={datos.nombres} onChange={(event) => setDatos({ ...datos, nombres: event.target.value })} />
    <TextField label="Apellidos" required maxLength={100} autoComplete="family-name" value={datos.apellidos} onChange={(event) => setDatos({ ...datos, apellidos: event.target.value })} />
    <TextField label="Teléfono (opcional)" type="tel" maxLength={20} autoComplete="tel" value={datos.telefono} onChange={(event) => setDatos({ ...datos, telefono: event.target.value })} />
    {error && <Aviso tipo="error">{error}</Aviso>}
    <div className="grid gap-3">
      <Button type="submit" loading={ocupado}>Guardar cambios</Button>
      <Button variant="outline" onClick={alCancelar}>Cancelar</Button>
    </div>
  </form>
}

/* ───────────── Cambiar contraseña ───────────── */

/**
 * Pide la contraseña actual (se verifica iniciando una sesión efímera con ella) y guarda la nueva con Supabase Auth.
 * La sesión efímera se cierra al terminar: no toca la sesión del navegador ni deja contraseñas en memoria.
 * Si no recuerda la actual, el camino sigue siendo «Recuperar contraseña» (código por correo).
 */
export function FormularioContrasena({ correo, alGuardar, alCancelar }: { correo: string; alGuardar: () => void; alCancelar: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const requisitos = [
    { id: 'largo', texto: 'Al menos 8 caracteres', cumplido: nueva.length >= 8 },
    { id: 'mayuscula', texto: 'Una letra mayúscula', cumplido: /[A-Z]/.test(nueva) },
    { id: 'minuscula', texto: 'Una letra minúscula', cumplido: /[a-z]/.test(nueva) },
    { id: 'numero', texto: 'Un número', cumplido: /\d/.test(nueva) },
    { id: 'simbolo', texto: 'Un símbolo, como ! o #', cumplido: /[^a-zA-Z0-9\s]/.test(nueva) },
    ...(confirmar ? [{ id: 'coinciden', texto: 'Ambas contraseñas coinciden', cumplido: confirmar === nueva }] : []),
  ]
  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    if (ocupado) return
    const problema = passwordError(nueva) ?? (confirmar !== nueva ? 'Las contraseñas no coinciden.' : undefined) ?? (nueva === actual ? 'La nueva contraseña debe ser distinta de la actual.' : undefined)
    if (problema) {
      setError(problema)
      return
    }
    setOcupado(true)
    setError('')
    const cliente = temporaryClient()
    try {
      const { data, error: rechazo } = await cliente.auth.signInWithPassword({ email: correo, password: actual })
      if (rechazo || !data.session) {
        setError('La contraseña actual no es correcta.')
        return
      }
      const cambio = await cliente.auth.updateUser({ password: nueva })
      if (cambio.error) {
        setError('No se pudo guardar la contraseña. Revisa los requisitos e intenta de nuevo.')
        return
      }
      setActual('')
      setNueva('')
      setConfirmar('')
      alGuardar()
    } catch {
      setError('No se pudo cambiar la contraseña. Revisa tu conexión e intenta de nuevo.')
    } finally {
      void cliente.auth.signOut({ scope: 'local' }).catch(() => {})
      setOcupado(false)
    }
  }
  return <form className="grid gap-5" onSubmit={enviar}>
    <PasswordField label="Contraseña actual" required autoComplete="current-password" value={actual} onChange={(event) => setActual(event.target.value)} />
    <PasswordField label="Nueva contraseña" required autoComplete="new-password" value={nueva} onChange={(event) => setNueva(event.target.value)} />
    <RequisitosContrasena requisitos={requisitos} titulo="Tu contraseña nueva debe tener:" />
    <PasswordField label="Confirmar nueva contraseña" required autoComplete="new-password" value={confirmar} onChange={(event) => setConfirmar(event.target.value)} />
    {error && <Aviso tipo="error">{error}</Aviso>}
    <div className="grid gap-3">
      <Button type="submit" loading={ocupado}>Guardar contraseña</Button>
      <Button variant="outline" onClick={alCancelar}>Cancelar</Button>
    </div>
    <p className="text-ayuda text-ink-2">
      ¿No recuerdas la actual? <Link to="/recuperar" className="font-semibold text-navy underline underline-offset-[3px]">Recupérala con un código por correo</Link>.
    </p>
  </form>
}

/* ───────────── Mi perfil ───────────── */

export function PerfilCuenta({ token, usuario, cuenta, cargando, error, alReintentar, alGuardado, alCerrarSesion, invitaciones, cuentas, resumen }: {
  token: string
  /** Falta mientras se consulta el perfil. */
  usuario?: CurrentUser
  cuenta?: CuentaMe
  cargando: boolean
  error: string
  alReintentar: () => void
  /** Recarga el perfil tras guardar. */
  alGuardado: () => void
  alCerrarSesion: () => void
  invitaciones: ReactNode
  cuentas: ReactNode
  resumen: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const vistaEstado = (location.state as { vista?: unknown } | null)?.vista
  const vista: Vista = vistaEstado === 'editar' || vistaEstado === 'contrasena' ? vistaEstado : 'ver'
  const [aviso, setAviso] = useState('')
  const perfil = usuario?.profile
  const raiz = cuenta ? `/operacion/${encodeURIComponent(cuenta.cuenta_id)}` : undefined
  const ir = (destino: Vista) => {
    setAviso('')
    navigate('/cuenta', { state: { vista: destino } })
  }
  const volverAVer = (texto?: string) => {
    if (texto) setAviso(texto)
    // La vista se abrió con un push: Atrás la quita; si se recargó directamente en ella, se reemplaza.
    if (window.history.length > 1) navigate(-1)
    else navigate('/cuenta', { replace: true })
  }
  // En la vista principal «Volver» regresa a la pantalla desde la que se llegó (Inicio, Más…).
  const volver = vista === 'ver' ? { destino: raiz ? `${raiz}/cuenta` : '/inicio', historial: true } : { destino: '/cuenta', accion: () => volverAVer() }

  return <PaginaSecundaria titulo={TITULOS[vista]} volver={volver} raizAyuda={raiz}>
    {error && <Aviso tipo="error">{error}</Aviso>}
    {cargando && !error && <p role="status" className="text-ayuda text-muted">Comprobando perfil…</p>}
    {error && <Button variant="outline" onClick={alReintentar}>Reintentar</Button>}
    {perfil && usuario && <>
      {vista !== 'ver' && <CabeceraPerfil perfil={perfil} cuenta={cuenta} />}
      {vista === 'editar' && <FormularioPerfil key={usuario.identity.id} token={token} perfil={perfil} alCancelar={() => volverAVer()}
        alGuardar={() => { alGuardado(); volverAVer('Cambios guardados.') }} />}
      {vista === 'contrasena' && <FormularioContrasena correo={usuario.identity.email} alCancelar={() => volverAVer()}
        alGuardar={() => volverAVer('Contraseña actualizada.')} />}
      {vista === 'ver' && <>
        {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
        <CabeceraPerfil perfil={perfil} cuenta={cuenta}>
          <Button variant="ghost" onClick={() => ir('editar')}>Editar perfil</Button>
        </CabeceraPerfil>
        {invitaciones}
        <section aria-labelledby="titulo-datos" className="grid gap-3">
          <h2 id="titulo-datos" className="text-seccion text-ink">Información personal</h2>
          <dl className={cn(TARJETA, 'divide-y divide-surface-2')}>
            <FilaDato icono="mail" etiqueta="Correo electrónico" valor={perfil.correo} />
            <FilaDato icono="badge" etiqueta="Cédula" valor={formatearCedula(perfil.cedula)} />
            <FilaDato icono="call" etiqueta="Teléfono" valor={perfil.telefono ? formatearTelefono(perfil.telefono) : 'Sin registrar'} />
          </dl>
        </section>
        {cuentas}
        {resumen}
        <section aria-labelledby="titulo-seguridad" className="grid gap-3">
          <h2 id="titulo-seguridad" className="text-seccion text-ink">Seguridad y privacidad</h2>
          <div className={cn(TARJETA, 'divide-y divide-surface-2 px-3')}>
            <FilaLista icono="lock" titulo="Cambiar contraseña" descripcion="Te pedimos la actual por seguridad" onClick={() => ir('contrasena')} />
            <FilaLista icono="receipt_long" titulo="Términos de uso" descripcion="Condiciones de uso del servicio" to="/terminos" />
            <FilaLista icono="privacy_tip" titulo="Política de privacidad" descripcion="Cómo cuidamos tus datos personales" to="/privacidad" />
          </div>
        </section>
        <Button variant="danger" fullWidth icon={<Icono nombre="logout" tamano={22} />} onClick={alCerrarSesion}>Cerrar sesión</Button>
      </>}
    </>}
    {!perfil && <Button variant="outline" onClick={alCerrarSesion}>Cerrar sesión</Button>}
  </PaginaSecundaria>
}
