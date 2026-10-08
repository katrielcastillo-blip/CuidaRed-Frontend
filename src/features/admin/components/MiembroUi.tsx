import { CircleUserRound, UserRound } from 'lucide-react'
import type { EstadoMiembro, Rol } from '@/domain/types'
import styles from './MiembroUi.module.css'

const ROL_TXT: Partial<Record<Rol, string>> = { cuidador: 'Cuidador', coordinador: 'Coordinador', familiar: 'Familiar', admin: 'Administrador' }
const ESTADO_TXT: Record<EstadoMiembro, string> = { activo: 'Activo', inactivo: 'Inactivo', invitado: 'Invitado' }

export const rolTexto = (r: Rol) => ROL_TXT[r] ?? r
export const estadoTexto = (e: EstadoMiembro) => ESTADO_TXT[e]

/** Chip de rol: Coordinador azul brillante · Cuidador navy (como el Figma). `grande` = versión del perfil. */
export function RolBadge({ rol, inactivo, grande }: { rol: Rol; inactivo?: boolean; grande?: boolean }) {
  const tono = inactivo ? styles.rolOff : rol === 'coordinador' ? styles.rolCoord : styles.rolCuid
  return <span className={`${styles.chip} ${tono} ${grande ? styles.grande : ''}`}>{rolTexto(rol)}</span>
}

/** Chip de estado: Activo verde · Inactivo gris · Invitado ámbar. `grande` = versión del perfil. */
export function EstadoBadge({ estado, grande }: { estado: EstadoMiembro; grande?: boolean }) {
  const tono = estado === 'activo' ? styles.estOn : estado === 'invitado' ? styles.estInv : styles.rolOff
  return <span className={`${styles.chip} ${tono} ${grande ? styles.grande : ''}`}>{estadoTexto(estado)}</span>
}

/** Avatar de miembro: foto si existe; si no, el icono de usuario sobre azul (gris si está inactivo). */
export function MiembroAvatar({ src, inactivo, size = 48 }: { src?: string; inactivo?: boolean; size?: number }) {
  return (
    <span className={`${styles.tile} ${inactivo ? styles.tileOff : ''}`} style={{ width: size, height: size }} aria-hidden>
      {src ? <img src={src} alt="" /> : <UserRound size={Math.round(size * 0.5)} />}
    </span>
  )
}

/** Avatar grande del perfil del miembro (círculo con silueta, azul del Figma). */
export function MiembroAvatarGrande({ src, size = 128 }: { src?: string; size?: number }) {
  return src ? (
    <span className={styles.fotoGrande} style={{ width: size, height: size }} aria-hidden>
      <img src={src} alt="" />
    </span>
  ) : (
    <CircleUserRound className={styles.siluetaGrande} size={size} strokeWidth={1.4} aria-hidden />
  )
}
