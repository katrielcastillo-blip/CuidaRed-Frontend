import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Laugh } from 'lucide-react'
import { nombreCompleto, useUser } from '@/domain/auth'
import { mutate, useDB } from '@/domain/store'
import { Button, useToast } from '@/components/ui'
import styles from './InvitacionOverlay.module.css'

/**
 * "Pantalla Invitación" del Figma: sobre el dashboard aparece una tarjeta con carita sonriente y el texto
 * "<Fulano> te ha invitado a ser parte de la familia". Es la invitación RECIBIDA: se muestra cuando existe
 * una Invitacion pendiente dirigida al correo del usuario en sesión.
 * El Figma no dibuja botones; se añaden Aceptar / Rechazar para que la invitación se pueda resolver de verdad.
 * Esc la oculta solo en esta visita (sigue pendiente).
 */
export function InvitacionOverlay() {
  const user = useUser()
  const invitaciones = useDB((s) => s.invitaciones)
  const usuarios = useDB((s) => s.usuarios)
  const familias = useDB((s) => s.familias)
  const toast = useToast()
  const [ocultas, setOcultas] = useState<string[]>([])
  const tituloId = useId()
  const dialogo = useRef<HTMLDivElement>(null)

  const invitacion = useMemo(() => {
    const correo = user.email.trim().toLowerCase()
    return invitaciones.find((i) => i.estado === 'pendiente' && i.email.trim().toLowerCase() === correo && !ocultas.includes(i.id))
  }, [invitaciones, user.email, ocultas])

  const invitacionId = invitacion?.id
  useEffect(() => {
    if (!invitacionId) return
    const previo = document.activeElement as HTMLElement | null
    dialogo.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOcultas((o) => [...o, invitacionId])
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [invitacionId])

  if (!invitacion) return null
  const quien = usuarios.find((u) => u.id === invitacion.invitadoPor)
  const familia = familias.find((f) => f.id === invitacion.familiaId)

  const responder = (aceptar: boolean) => {
    mutate((db) => {
      const inv = db.invitaciones.find((i) => i.id === invitacion.id)
      if (inv) inv.estado = aceptar ? 'aceptada' : 'rechazada'
      if (aceptar) {
        const yo = db.usuarios.find((u) => u.id === user.id)
        if (yo && !yo.familiaIds.includes(invitacion.familiaId)) yo.familiaIds.push(invitacion.familiaId)
      }
    })
    toast(aceptar ? `Ahora formas parte de ${familia?.nombre ?? 'la familia'}` : 'Invitación rechazada')
  }

  return createPortal(
    <div className={styles.fondo}>
      <div ref={dialogo} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={tituloId} className={styles.tarjeta}>
        <Laugh size={76} strokeWidth={1.7} aria-hidden />
        <p id={tituloId} className={styles.mensaje}>
          {quien ? nombreCompleto(quien) : 'Un familiar'} te ha invitado a ser parte de la familia
        </p>
        {familia && <p className={styles.familia}>{familia.nombre}</p>}
        <div className={styles.acciones}>
          <Button fullWidth onClick={() => responder(true)}>
            Aceptar
          </Button>
          <Button fullWidth variant="outline" onClick={() => responder(false)}>
            Rechazar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
