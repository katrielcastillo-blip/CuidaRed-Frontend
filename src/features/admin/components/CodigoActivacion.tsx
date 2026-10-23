/*
 * CodigoActivacion.tsx — Panel que muestra UNA sola vez el código de activación de una cuenta invitada.
 * Solo se guarda su hash: si se pierde, se genera uno nuevo desde el perfil del usuario.
 * Módulo: admin (CU-13 · SRS §8.2.2.3.5 b).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button, Sheet, useToast } from '@/components/ui'
import { DIAS_CODIGO_ACTIVACION, reenviarInvitacion } from '@/domain/api'
import { useUser } from '@/domain/auth'

export function CodigoActivacion({ codigo, email, onCerrar }: { codigo: string | null; email: string; onCerrar: () => void }) {
  const toast = useToast()
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo ?? '')
      toast('Código copiado')
    } catch {
      toast('No se pudo copiar: anótalo manualmente.', 'error')
    }
  }
  return (
    <Sheet
      open={!!codigo}
      onClose={onCerrar}
      title="Código de activación"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => void copiar()}>
            Copiar código
          </Button>
          <Button size="sm" onClick={onCerrar}>
            Listo
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center" data-testid="codigo-activacion">
        <span className="grid place-items-center size-14 rounded-full bg-blue-100 text-navy">
          <KeyRound size={28} aria-hidden />
        </span>
        <p className="text-ink-2">
          Entrega este código a <strong>{email}</strong>. Lo necesitará en «Activar mi cuenta» para activar su acceso y elegir su propia contraseña.
        </p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em] text-navy" aria-label={`Código ${codigo?.split('').join(' ')}`}>
          {codigo}
        </p>
        <p className="text-sm text-muted">
          Es de un solo uso y caduca en {DIAS_CODIGO_ACTIVACION} días. Por seguridad no se volverá a mostrar: si se pierde, genera uno nuevo desde el perfil del usuario.
          En producción llegaría por correo electrónico.
        </p>
      </div>
    </Sheet>
  )
}

/** Botón para generar un código nuevo de una cuenta que sigue invitada (el anterior deja de servir). */
export function ReenviarInvitacion({ usuarioId, email, deshabilitado }: { usuarioId: string; email: string; deshabilitado?: boolean }) {
  const admin = useUser()
  const toast = useToast()
  const [codigo, setCodigo] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const generar = async () => {
    setCargando(true)
    const r = await reenviarInvitacion(admin, usuarioId)
    setCargando(false)
    if (r.ok) setCodigo(r.valor)
    else toast(r.error, 'error')
  }
  return (
    <>
      <Button variant="outline" size="sm" icon={<KeyRound size={18} aria-hidden />} loading={cargando} disabled={deshabilitado} onClick={() => void generar()}>
        Generar nuevo código de activación
      </Button>
      <CodigoActivacion codigo={codigo} email={email} onCerrar={() => setCodigo(null)} />
    </>
  )
}
