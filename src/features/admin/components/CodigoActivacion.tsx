/*
 * CodigoActivacion.tsx — Panel que muestra UNA sola vez el código de activación de una cuenta invitada, con el mensaje
 * de invitación listo para copiar o compartir (la persona lo usa en «Activar mi cuenta», /registro).
 * Solo se guarda su hash: si se pierde, se genera uno nuevo desde el perfil del miembro.
 * Módulo: admin (CU-13 · SRS §8.2.2.3.5 b · invitación de Voluntario ocasional).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { Copy, KeyRound, Share2 } from 'lucide-react'
import { Button, Sheet, useToast } from '@/components/ui'
import { DIAS_CODIGO_ACTIVACION, reenviarInvitacion } from '@/domain/api'
import { ROL_LABEL, useSession, useUser } from '@/domain/auth'
import type { Rol } from '@/domain/types'

/** Mensaje de invitación con el enlace de activación, el correo y el código (para WhatsApp, SMS o correo). */
function mensajeInvitacion(email: string, codigo: string, cuenta?: string, rol?: Rol) {
  const donde = cuenta ? ` a «${cuenta}»` : ''
  const como = rol ? ` como ${ROL_LABEL[rol]}` : ''
  return `Te invitaron${donde} en CuidaRed${como}. Activa tu cuenta en ${window.location.origin}/registro con el correo ${email} y este código: ${codigo}. Caduca en ${DIAS_CODIGO_ACTIVACION} días.`
}

export function CodigoActivacion({ codigo, email, rol, onCerrar }: { codigo: string | null; email: string; rol?: Rol; onCerrar: () => void }) {
  const toast = useToast()
  const { org } = useSession()
  const copiar = async (texto: string, aviso: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast(aviso)
    } catch {
      toast('No se pudo copiar: anótalo manualmente.', 'error')
    }
  }
  const mensaje = codigo ? mensajeInvitacion(email, codigo, org?.nombre, rol) : ''
  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const compartir = async () => {
    try {
      await navigator.share({ title: 'Invitación a CuidaRed', text: mensaje })
    } catch {
      /* la persona cerró el panel de compartir: no es un error */
    }
  }
  return (
    <Sheet
      open={!!codigo}
      onClose={onCerrar}
      title="Código de activación"
      footer={
        <Button size="sm" onClick={onCerrar}>
          Listo
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center" data-testid="codigo-activacion">
        <span className="grid place-items-center size-14 rounded-full bg-blue-100 text-navy">
          <KeyRound size={28} aria-hidden />
        </span>
        <p className="text-ink-2">
          Entrega este código a <strong>{email}</strong>
          {rol ? ` (${ROL_LABEL[rol]})` : ''}. Lo necesitará en «Activar mi cuenta» para activar su acceso y elegir su propia contraseña.
        </p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em] text-navy" aria-label={`Código ${codigo?.split('').join(' ')}`}>
          {codigo}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" icon={<Copy size={18} aria-hidden />} onClick={() => void copiar(codigo ?? '', 'Código copiado')}>
            Copiar código
          </Button>
          <Button variant="outline" size="sm" icon={<Copy size={18} aria-hidden />} onClick={() => void copiar(mensaje, 'Invitación copiada')}>
            Copiar invitación
          </Button>
          {puedeCompartir && (
            <Button variant="outline" size="sm" icon={<Share2 size={18} aria-hidden />} onClick={() => void compartir()}>
              Compartir
            </Button>
          )}
        </div>
        <p className="text-sm text-muted">
          Es de un solo uso y caduca en {DIAS_CODIGO_ACTIVACION} días. Por seguridad no se volverá a mostrar: si se pierde, genera uno nuevo desde el perfil del miembro. En
          producción llegaría por correo electrónico.
        </p>
      </div>
    </Sheet>
  )
}

/** Botón para generar un código nuevo de una cuenta que sigue invitada (el anterior deja de servir). */
export function ReenviarInvitacion({ usuarioId, email, rol, deshabilitado }: { usuarioId: string; email: string; rol?: Rol; deshabilitado?: boolean }) {
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
      <CodigoActivacion codigo={codigo} email={email} rol={rol} onCerrar={() => setCodigo(null)} />
    </>
  )
}
