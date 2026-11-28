/*
 * AgregarMiembro.tsx — Alta de miembro de la cuenta: datos, rol (solo los del tipo de cuenta: Familia u Organización),
 * adultos mayores a los que tendrá acceso y modo de acceso. Por defecto se genera una INVITACIÓN con su código de
 * activación para compartir (la persona activa su cuenta en «Activar mi cuenta», /registro, y elige su contraseña);
 * opcionalmente se define una contraseña inicial que cumple la política. Con el rol Voluntario es la invitación del
 * voluntario ocasional: registra visitas sin plan propio y no cuenta para el límite de usuarios del plan. Si el correo
 * ya pertenece a una persona registrada en otra cuenta, se le agrega una membresía (no se duplica la persona).
 * Tablas: Usuario, Membresia (rol inicial), Invitacion y Vinculo (adultos con acceso).
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.3.5 b/d · §8.2.2.1.18 Operabilidad · Reglas de Negocio V2 §Cuenta y §Voluntario).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { Button, ChoicePills, PasswordField, SuccessOverlay, useToast } from '@/components/ui'
import { crearUsuario, errorDeCupo } from '@/domain/api'
import { useSession, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { puede } from '@/domain/permisos'
import { tipoDeCuenta } from '@/domain/planes'
import { REGLAS_PASSWORD } from '@/domain/seguridad'
import { useDB } from '@/domain/store'
import type { Rol } from '@/domain/types'
import { useBorrador } from '@/lib/useBorrador'
import { cn } from '@/lib/cn'
import { Page, useShell } from '@/layouts/AppShell'
import { AvisoSinConexion, Nota } from '../components/Nota'
import { CAMPOS_VACIOS, UsuarioCampos, type CamposUsuario, type ErroresUsuario } from '../components/UsuarioCampos'
import { volver } from '../lib/datos'
import { CodigoActivacion } from '../components/CodigoActivacion'

type Modo = 'invitacion' | 'password'
const MODOS: Array<{ value: Modo; label: string }> = [
  { value: 'invitacion', label: 'Enviar invitación' },
  { value: 'password', label: 'Definir contraseña' },
]

interface Creado {
  id: string
  invitado: boolean
  codigo?: string
  email: string
  rol: Rol
  yaExistia: boolean
}

export default function AgregarMiembro() {
  const { base } = useShell()
  const admin = useUser()
  const { org } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const adultos = useDB((s) => s.adultos)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const catalogos = useDB((s) => s.catalogos)
  // El borrador conserva lo escrito si se recarga la pantalla. La contraseña NUNCA se guarda en el borrador.
  const [datos, setDatos, descartar] = useBorrador<CamposUsuario>('admin:nuevo-usuario', CAMPOS_VACIOS)
  const [modo, setModo] = useState<Modo>('invitacion')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<ErroresUsuario>({})
  const [enviando, setEnviando] = useState(false)
  const [creado, setCreado] = useState<Creado | null>(null)

  const tipo = tipoDeCuenta(org)
  const esVoluntario = datos.rol === 'voluntario'
  /** Aviso del plan: si el rol elegido no cabe (los voluntarios no cuentan), no se deja enviar. */
  const cupo = useMemo(() => (datos.rol ? errorDeCupo({ adultos, usuarios, membresias, catalogos }, org, datos.rol) : undefined), [datos.rol, adultos, usuarios, membresias, catalogos, org])

  const cambiar = <K extends keyof CamposUsuario>(campo: K, valor: CamposUsuario[K]) => {
    // Al cambiar de rol se limpian los adultos marcados: autorizar a un familiar y asignar a un voluntario no son lo mismo.
    setDatos((d) => ({ ...d, [campo]: valor, ...(campo === 'rol' ? { adultoIds: [] } : {}) }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (modo === 'password' && !password) {
      setErrores((e) => ({ ...e, password: 'Escribe la contraseña inicial o elige "Enviar invitación".' }))
      return
    }
    setEnviando(true)
    const r = await crearUsuario(admin, { ...datos, password: modo === 'password' ? password : '' })
    setEnviando(false)
    if (!r.ok) {
      setErrores((r.errores ?? {}) as ErroresUsuario)
      toast(r.error, 'error')
      return
    }
    descartar()
    setPassword('')
    setCreado({ id: r.valor.id, invitado: r.valor.estado === 'invitado', codigo: r.valor.codigoActivacion, email: r.valor.email, rol: r.valor.rol, yaExistia: !!r.valor.yaExistia })
  }

  const cancelar = () => {
    descartar()
    volver(navigate, `${base}/miembros`)
  }

  const irAlPerfil = () => creado && navigate(`${base}/miembros/${creado.id}`, { replace: true })

  return (
    <Page title="Agregar miembro" back={`${base}/miembros`}>
      <form className="flex flex-col gap-5" onSubmit={enviar} noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold">Nuevo miembro</h2>
          <p className="text-muted">
            Registra los datos de la persona, elige su rol y los adultos mayores a los que tendrá acceso.
            {tipo === 'familia' ? ' En una cuenta Familia puedes ofrecer Coordinador, Cuidador y Familiar.' : ''} Los campos con * son obligatorios.
          </p>
        </div>

        {!enLinea && <AvisoSinConexion />}

        <UsuarioCampos datos={datos} errores={errores} onChange={cambiar} />

        {cupo && (
          <Nota tono="warning">
            {cupo}{' '}
            {puede(admin, 'cuenta:suscripcion') && (
              <Link to={`${base}/suscripcion`} className="font-bold text-navy underline">
                Ver plan
              </Link>
            )}
          </Nota>
        )}

        <section className="flex flex-col gap-4 p-4 rounded-md bg-surface shadow-1" aria-labelledby="h-acceso">
          <h3 id="h-acceso" className="text-base font-bold">
            {esVoluntario ? 'Invitación del voluntario' : 'Acceso a la cuenta'}
          </h3>
          <ChoicePills
            label="¿Cómo obtendrá su contraseña?"
            value={modo}
            options={MODOS}
            onChange={(m) => {
              setModo(m)
              setErrores((e) => ({ ...e, password: undefined }))
            }}
            help="Recomendado: enviar invitación. Así solo la persona conoce su contraseña. Define una contraseña inicial solo si la persona no puede activar la cuenta por sí misma."
          />
          {modo === 'invitacion' ? (
            <Nota>
              Al guardar se genera un <strong>código de activación</strong> para compartir con la persona (copiar o enviar por mensaje). La cuenta queda como{' '}
              <strong>Invitado</strong>; la persona la activa desde <strong>“Activar mi cuenta”</strong> con este mismo correo y el código, y elige su propia contraseña.
              {esVoluntario && ' Al activarla entra directo a su área de voluntario para registrar visitas.'}
            </Nota>
          ) : (
            <>
              <PasswordField
                label="Contraseña inicial"
                required
                autoComplete="new-password"
                value={password}
                error={errores.password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errores.password) setErrores((x) => ({ ...x, password: undefined }))
                }}
              />
              <ul className="grid gap-1 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
                {REGLAS_PASSWORD.map((regla) => {
                  const ok = regla.ok(password)
                  return (
                    <li key={regla.id} className={cn('flex items-center gap-2 text-sm', ok ? 'text-success-700 font-semibold' : 'text-muted')}>
                      {ok ? <Check size={16} strokeWidth={3} aria-hidden /> : <X size={16} aria-hidden />}
                      <span>
                        {regla.texto}
                        <span className="sr-only">{ok ? ' (cumplido)' : ' (pendiente)'}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-sm text-muted">Comunícale la contraseña por un medio seguro y pídele que la cambie al entrar. La cuenta quedará activa de inmediato.</p>
            </>
          )}
        </section>

        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
          <Button type="submit" fullWidth loading={enviando} disabled={!enLinea || !!cupo}>
            {modo === 'invitacion' ? 'Guardar y generar invitación' : 'Crear miembro'}
          </Button>
          <Button variant="outline" className="border-navy!" fullWidth onClick={cancelar}>
            Cancelar
          </Button>
        </div>
      </form>

      <SuccessOverlay
        open={!!creado && !creado.invitado}
        message={creado?.yaExistia ? '¡Miembro agregado!' : '¡Miembro creado!'}
        detail={creado?.yaExistia ? 'Ya usaba CuidaRed: se agregó a tu cuenta con su perfil actual. Elige esta cuenta en el selector para entrar.' : 'La cuenta ya puede iniciar sesión.'}
        onDone={irAlPerfil}
      />
      <CodigoActivacion codigo={creado?.invitado ? (creado.codigo ?? null) : null} email={creado?.email ?? ''} rol={creado?.rol} onCerrar={irAlPerfil} />
    </Page>
  )
}
