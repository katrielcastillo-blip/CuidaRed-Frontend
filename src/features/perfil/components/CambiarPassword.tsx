/*
 * CambiarPassword.tsx — Panel "Cambiar contraseña": verifica la actual y aplica la política de contraseñas
 * robustas con la lista de requisitos en vivo.
 * Módulo: perfil (SRS §8.2.2.3.5 b · servicio cambiarPassword de @/domain/api).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type FormEvent } from 'react'
import { Button, PasswordField, Sheet, useToast } from '@/components/ui'
import { cambiarPassword } from '@/domain/api'
import { useEnLinea } from '@/domain/conectividad'
import type { Usuario } from '@/domain/types'
import { Aviso, RequisitosPassword } from '@/features/auth/components/Piezas'
import { errorConfirmacion, hayErrores } from '@/features/auth/lib/validar'

const FORM_ID = 'form-cambiar-password'

interface Errores {
  actual?: string
  nueva?: string
  confirmar?: string
}

function Formulario({ user, onListo, onCargando }: { user: Usuario; onListo: () => void; onCargando: (v: boolean) => void }) {
  const toast = useToast()
  const enLinea = useEnLinea()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (enviando) return
    const locales: Errores = {
      actual: actual ? undefined : 'Escribe tu contraseña actual.',
      confirmar: errorConfirmacion(nueva, confirmar),
    }
    setErrores(locales)
    if (hayErrores({ ...locales })) return
    setEnviando(true)
    onCargando(true)
    try {
      const res = await cambiarPassword(user, actual, nueva)
      if (res.ok) {
        toast('Contraseña actualizada')
        onListo()
        return
      }
      setErrores((x) => ({ ...x, ...res.errores }))
      if (!res.errores) setGeneral(res.error)
    } finally {
      setEnviando(false)
      onCargando(false)
    }
  }

  return (
    <form id={FORM_ID} onSubmit={guardar} noValidate className="flex flex-col gap-4" aria-busy={enviando || undefined}>
      {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para cambiar tu contraseña.</Aviso>}
      <PasswordField
        label="Contraseña actual"
        autoComplete="current-password"
        value={actual}
        error={errores.actual}
        onChange={(e) => {
          setActual(e.target.value)
          setErrores((x) => ({ ...x, actual: undefined }))
        }}
      />
      <PasswordField
        label="Nueva contraseña"
        autoComplete="new-password"
        value={nueva}
        error={errores.nueva}
        onChange={(e) => {
          setNueva(e.target.value)
          setErrores((x) => ({ ...x, nueva: undefined }))
        }}
      />
      <PasswordField
        label="Confirmar nueva contraseña"
        autoComplete="new-password"
        value={confirmar}
        error={errores.confirmar}
        onChange={(e) => {
          setConfirmar(e.target.value)
          setErrores((x) => ({ ...x, confirmar: undefined }))
        }}
      />
      <RequisitosPassword password={nueva} confirmar={confirmar} />
      {general && <Aviso tono="error">{general}</Aviso>}
    </form>
  )
}

/** Sheet "Cambiar contraseña". */
export function CambiarPassword({ open, onClose, user }: { open: boolean; onClose: () => void; user: Usuario }) {
  const enLinea = useEnLinea()
  const [cargando, setCargando] = useState(false)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cambiar contraseña"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" form={FORM_ID} loading={cargando} disabled={!enLinea}>
            Guardar
          </Button>
        </>
      }
    >
      <Formulario user={user} onListo={onClose} onCargando={setCargando} />
    </Sheet>
  )
}
