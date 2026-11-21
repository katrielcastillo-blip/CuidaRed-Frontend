/*
 * DesactivarCuenta.tsx — Desactivar mi cuenta (reemplaza "Eliminar cuenta"): explica qué pasa, pide la contraseña
 * actual y la casilla "Entiendo", y se bloquea con un mensaje claro si la persona es titular de una cuenta.
 * Módulo: perfil (CU-01 "Eliminar cuenta" · HU-01 · RF-1.4 · Reglas de Negocio V2 §Membresía: desactivar conserva
 * el historial).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Building2, LogOut, RefreshCcw, RotateCcw, ShieldAlert, UserRoundX } from 'lucide-react'
import { Button, ButtonLink, Checkbox, PasswordField, requerido, useFormulario, useToast } from '@/components/ui'
import { bloqueosDesactivacion, desactivarMiCuenta } from '@/domain/api/perfil'
import { ROL_LABEL, useMisCuentas, useSession } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { tipoDeCuenta } from '@/domain/planes'
import { useDB } from '@/domain/store'
import { usePendientes } from '@/domain/sync'
import type { Organizacion, Usuario } from '@/domain/types'
import { Aviso } from '@/features/auth/components/Piezas'
import { Page, useShell } from '@/layouts/AppShell'
import { aResponsableDeCuenta } from '../lib/rol'

interface DatosDesactivar {
  password: string
  entiendo: boolean
}

/** Ni la contraseña ni la casilla se guardan como borrador: cada vez se confirma de nuevo. */
const NO_GUARDAR: Array<keyof DatosDesactivar> = ['password', 'entiendo']

const TARJETA = 'flex flex-col gap-6 md:rounded-lg md:border md:border-line-soft md:bg-surface md:px-10 md:py-8 md:shadow-1'

/** Una consecuencia de desactivar la cuenta, con su icono. */
function Consecuencia({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-10 flex-none place-items-center rounded-md bg-blue-100 text-navy" aria-hidden>
        {icono}
      </span>
      <p className="min-w-0 flex-1 pt-1.5 leading-snug text-ink-2">{children}</p>
    </li>
  )
}

function Encabezado() {
  return (
    <header className="flex items-center gap-3.5">
      <span className="grid size-14 flex-none place-items-center rounded-md bg-danger-100 text-danger" aria-hidden>
        <UserRoundX size={28} />
      </span>
      <h2 className="text-xl font-bold leading-tight text-ink">¿Quieres desactivar tu cuenta?</h2>
    </header>
  )
}

function Vista({ user, org }: { user: Usuario; org: Organizacion | null }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const pendientes = usePendientes().length
  const cuentas = useMisCuentas()
  const orgs = useDB((s) => s.orgs)
  const membresias = useDB((s) => s.membresias)
  const usuarios = useDB((s) => s.usuarios)
  const [general, setGeneral] = useState<string>()

  const bloqueos = useMemo(() => bloqueosDesactivacion({ orgs, membresias, usuarios }, user.id), [orgs, membresias, usuarios, user.id])

  const f = useFormulario<DatosDesactivar>({
    clave: `desactivar:${user.id}`,
    inicial: { password: '', entiendo: false },
    excluirDeBorrador: NO_GUARDAR,
    campos: ['password', 'entiendo'],
    reglas: {
      password: requerido('Escribe tu contraseña actual para confirmar.'),
      entiendo: requerido('Marca la casilla para confirmar que lo entiendes.'),
    },
  })

  const volver = `${base}/perfil`

  const desactivar = f.enviar(async (v) => {
    setGeneral(undefined)
    const res = await desactivarMiCuenta(user, v.password)
    if (res.ok) {
      // El servicio ya cerró la sesión: se vuelve a la pantalla de inicio.
      toast('Tu cuenta fue desactivada. Gracias por acompañar a tu comunidad.', 'info')
      navigate('/inicio', { replace: true })
    } else if (!res.errores) {
      setGeneral(res.error)
    }
    return res
  })

  /* ───────────── Bloqueada: titular de una cuenta o único administrador ───────────── */
  if (bloqueos.length > 0) {
    return (
      <Page title="Desactivar mi cuenta" back={volver} hideAvatar>
        <div className={TARJETA}>
          <Encabezado />
          <Aviso tono="warning" icono={<ShieldAlert size={18} />}>
            <p className="font-semibold">Todavía no puedes desactivar tu cuenta.</p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-4">
              {bloqueos.map((b) => (
                <li key={`${b.tipo}-${b.orgId}`}>{b.mensaje}</li>
              ))}
            </ul>
          </Aviso>
          <p className="leading-normal text-ink-2">
            Así evitamos que una cuenta quede sin una persona responsable de sus accesos y de su suscripción. Cuando otra persona sea la titular, podrás volver a esta pantalla y
            desactivar tu cuenta.
          </p>
          <ButtonLink to={volver} variant="outline" fullWidth>
            Volver a mi perfil
          </ButtonLink>
        </div>
      </Page>
    )
  }

  const varias = cuentas.length > 1
  const sinSincronizar = pendientes > 0
  const impedida = !enLinea || sinSincronizar
  const motivoId = 'desactivar-motivo'

  return (
    <Page title="Desactivar mi cuenta" back={volver} hideAvatar>
      <form className={TARJETA} onSubmit={desactivar} noValidate aria-busy={f.enviando || undefined}>
        <Encabezado />

        <section aria-labelledby="desactivar-que-pasa" className="flex flex-col gap-3.5">
          <h3 className="font-bold text-ink" id="desactivar-que-pasa">
            Qué pasa si continúas
          </h3>
          <ul className="flex flex-col gap-3.5">
            <Consecuencia icono={<Archive size={20} />}>
              <strong className="text-ink">Tu historial se conserva.</strong> Las visitas, necesidades y registros que hiciste siguen en el expediente de los adultos mayores.
            </Consecuencia>
            <Consecuencia icono={<LogOut size={20} />}>
              <strong className="text-ink">Se cierra tu sesión</strong> en este dispositivo y no podrás volver a entrar hasta que reactiven tu acceso.
            </Consecuencia>
            <Consecuencia icono={<Building2 size={20} />}>
              {varias ? (
                <>
                  <strong className="text-ink">Pierdes el acceso a tus {cuentas.length} cuentas:</strong>{' '}
                  {cuentas.map(({ membresia, org: cuenta }) => `${cuenta?.nombre ?? 'Cuenta'} (${ROL_LABEL[membresia.rol]})`).join(', ')}.
                </>
              ) : (
                <>
                  <strong className="text-ink">Pierdes el acceso a «{org?.nombre ?? 'tu cuenta'}»</strong> como {ROL_LABEL[user.rol].toLowerCase()}.
                </>
              )}
            </Consecuencia>
            <Consecuencia icono={<RotateCcw size={20} />}>
              <strong className="text-ink">Puedes volver.</strong> Pide {varias ? 'a la persona responsable de cada cuenta' : aResponsableDeCuenta(tipoDeCuenta(org))} que reactive tu
              acceso.
            </Consecuencia>
          </ul>
          <p className="text-sm leading-snug text-muted">Desactivar no borra tus datos personales. Para ejercer tu derecho de cancelación, consulta la Política de Privacidad.</p>
          <ButtonLink to="/privacidad" variant="ghost" className="-ml-4 self-start">
            Leer la Política de Privacidad
          </ButtonLink>
        </section>

        <section aria-labelledby="desactivar-confirmar" className="flex flex-col gap-4">
          <h3 className="font-bold text-ink" id="desactivar-confirmar">
            Confirma que eres tú
          </h3>
          {sinSincronizar && (
            <Aviso tono="warning">
              <p id={motivoId}>
                Tienes {pendientes} registro{pendientes === 1 ? '' : 's'} sin sincronizar. Envíalos antes de desactivar tu cuenta para no perderlos.
              </p>
              <ButtonLink to={`${base}/sincronizacion`} variant="outline" size="sm" className="mt-2" icon={<RefreshCcw size={18} aria-hidden />}>
                Sincronizar ahora
              </ButtonLink>
            </Aviso>
          )}
          {!enLinea && (
            <Aviso tono="offline">
              <span id={motivoId}>Sin conexión: necesitas internet para desactivar tu cuenta. Conéctate e inténtalo de nuevo.</span>
            </Aviso>
          )}
          <PasswordField
            label="Contraseña actual"
            autoComplete="current-password"
            required
            help="La pedimos para confirmar que eres tú quien desactiva la cuenta."
            {...f.campo('password')}
          />
          <Checkbox
            label="Entiendo que mi acceso se desactivará y que solo la persona responsable de mi cuenta podrá reactivarlo."
            required
            {...f.casilla('entiendo')}
          />
          {general && <Aviso tono="error">{general}</Aviso>}
        </section>

        <div className="flex flex-col gap-3">
          <Button type="submit" variant="danger" fullWidth loading={f.enviando} disabled={impedida} aria-describedby={impedida ? motivoId : undefined}>
            Desactivar mi cuenta
          </Button>
          <Button variant="outline" fullWidth onClick={() => navigate(volver)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Page>
  )
}

/** Desactivar mi cuenta — compartido por los 5 roles. */
export default function DesactivarCuenta() {
  const { user, org } = useSession()
  if (!user) return null
  return <Vista key={user.id} user={user} org={org} />
}
