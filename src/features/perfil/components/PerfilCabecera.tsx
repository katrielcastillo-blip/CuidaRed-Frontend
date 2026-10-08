import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui'
import styles from '../Perfil.module.css'

/** Bloque superior de Mi Perfil / Editar: avatar grande, nombre, cédula, chip de etiqueta y acción. */
export function PerfilCabecera({
  nombre,
  avatar,
  size,
  cedula,
  etiqueta,
  editarHref,
  fotoAccion,
}: {
  nombre: string
  avatar?: string
  size: number
  cedula?: string
  etiqueta: string
  /** Mi Perfil: enlace "Editar Perfil". */
  editarHref?: string
  /** Editar Mi Perfil: botón de lápiz sobre el avatar. */
  fotoAccion?: ReactNode
}) {
  return (
    <header className={styles.cabecera}>
      <div className={styles.avatarWrap} style={{ width: size, height: size }}>
        <Avatar nombre={nombre} src={avatar} size={size} ring />
        {fotoAccion}
      </div>
      <h2 className={styles.nombre}>{nombre}</h2>
      {cedula && <p className={styles.cedula}>{cedula}</p>}
      <span className={styles.chip}>{etiqueta}</span>
      {editarHref && (
        <Link to={editarHref} className={styles.editarLink}>
          Editar Perfil
        </Link>
      )}
    </header>
  )
}
