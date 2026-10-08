import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, LogOut, Mail, Phone } from 'lucide-react'
import { Button, InfoRow, useToast } from '@/components/ui'
import { logout, nombreCompleto, useSession } from '@/domain/auth'
import { resetDemo } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { CambiarPassword } from '../components/CambiarPassword'
import { PerfilCabecera } from '../components/PerfilCabecera'
import { muestraCedula } from '../lib/rol'
import styles from '../Perfil.module.css'

function Vista({ user }: { user: Usuario }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const [cambiando, setCambiando] = useState(false)
  const conCedula = muestraCedula(user.rol)
  const cerrarPassword = useCallback(() => setCambiando(false), [])

  const salir = () => {
    logout()
    navigate('/inicio', { replace: true })
  }
  const reiniciar = () => {
    resetDemo()
    toast('Datos de demostración restablecidos')
    navigate('/inicio', { replace: true })
  }

  return (
    <Page title="Mi Perfil" back={base} hideAvatar>
      <div className={styles.panel}>
        <PerfilCabecera
          nombre={nombreCompleto(user)}
          avatar={user.avatar}
          size={conCedula ? 150 : 195}
          cedula={conCedula ? user.cedula : undefined}
          etiqueta={user.etiqueta}
          editarHref={`${base}/perfil/editar`}
        />

        <section className={styles.seccion} aria-labelledby="perfil-info">
          <h2 className="section-title" id="perfil-info">
            Información Personal
          </h2>
          <div className={styles.infoGrid}>
            <InfoRow icon={<Mail size={24} aria-hidden />} label="Correo electrónico" value={user.email} />
            <InfoRow icon={<Phone size={24} aria-hidden />} label="Teléfono" value={user.telefono} />
          </div>
        </section>

        <section className={styles.seccion} aria-labelledby="perfil-cuenta">
          <h2 className="section-title" id="perfil-cuenta">
            Cuenta
          </h2>
          <InfoRow
            icon={<Lock size={24} aria-hidden />}
            label="Contraseña"
            value="••••••••••••••••"
            action={
              <Button variant="ghost" size="sm" onClick={() => setCambiando(true)}>
                Cambiar
              </Button>
            }
          />
        </section>

        <div className={styles.acciones}>
          <Button variant="danger-soft" fullWidth icon={<LogOut size={22} aria-hidden />} onClick={salir}>
            Cerrar Sesión
          </Button>
        </div>
      </div>

      <div className={styles.demo}>
        <Button variant="ghost" size="sm" onClick={reiniciar}>
          Restablecer datos de demostración
        </Button>
      </div>

      <CambiarPassword open={cambiando} onClose={cerrarPassword} user={user} />
    </Page>
  )
}

/** Mi Perfil — compartido por los 4 roles (cuidador 358:2116 · familiar 285:575 · admin 238:575 · coordinador 361:692). */
export default function MiPerfil() {
  const { user } = useSession()
  if (!user) return null
  return <Vista user={user} />
}
