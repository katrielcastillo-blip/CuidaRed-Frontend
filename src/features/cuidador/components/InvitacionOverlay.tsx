import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Laugh } from 'lucide-react'
import { nombreCompleto, ROL_LABEL } from '@/domain/auth'
import { mutate, useDB } from '@/domain/store'
import type { Invitacion } from '@/domain/types'
import { Button, useToast } from '@/components/ui'
import styles from './InvitacionOverlay.module.css'

/**
 * Pantalla Invitación (Figma 358:2356): tarjeta sobre el dashboard con
 * «{Nombre} te ha invitado a ser parte de la familia como cuidador» y los botones Aceptar / Rechazar.
 * Aceptar: la invitación pasa a `aceptada` y la familia se añade a `user.familiaIds`. Rechazar: pasa a `rechazada`.
 */
export function InvitacionOverlay({
  invitacion,
  userId,
  onResuelta,
}: {
  invitacion: Invitacion
  userId: string
  /** Se llama tras decidir; `familiaId` solo si se aceptó. */
  onResuelta: (familiaId?: string) => void
}) {
  const toast = useToast()
  const usuarios = useDB((s) => s.usuarios)
  const familias = useDB((s) => s.familias)
  const invitador = usuarios.find((u) => u.id === invitacion.invitadoPor)
  const familia = familias.find((f) => f.id === invitacion.familiaId)
  const ref = useRef<HTMLDivElement>(null)

  // Bloquea el scroll del fondo y lleva el foco al diálogo mientras está abierto.
  useEffect(() => {
    ref.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  function decidir(aceptar: boolean) {
    mutate((db) => {
      const inv = db.invitaciones.find((i) => i.id === invitacion.id)
      if (!inv) return
      inv.estado = aceptar ? 'aceptada' : 'rechazada'
      if (aceptar) {
        const u = db.usuarios.find((x) => x.id === userId)
        if (u && !u.familiaIds.includes(inv.familiaId)) u.familiaIds.push(inv.familiaId)
      }
    })
    toast(aceptar ? `Ahora formas parte de ${familia?.nombre ?? 'la familia'}` : 'Invitación rechazada')
    onResuelta(aceptar ? invitacion.familiaId : undefined)
  }

  const quien = invitador ? nombreCompleto(invitador) : 'Un familiar'
  return createPortal(
    <div className={styles.fondo}>
      <div ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="invitacion-texto" className={styles.tarjeta}>
        <Laugh size={72} strokeWidth={1.6} aria-hidden />
        <p id="invitacion-texto" className={styles.texto}>
          {quien} te ha invitado a ser parte de la familia como {ROL_LABEL[invitacion.rol].toLowerCase()}
        </p>
        {familia && <p className={styles.familia}>{familia.nombre}</p>}
        <div className={styles.botones}>
          <Button fullWidth onClick={() => decidir(true)}>
            Aceptar
          </Button>
          <Button variant="outline" fullWidth onClick={() => decidir(false)}>
            Rechazar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
