import { useState, type FormEvent } from 'react'
import { Button, PasswordField, Sheet, useToast } from '@/components/ui'
import { mutate } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { errorConfirmacion, errorPassword, hayErrores } from '@/features/auth/lib/validar'

const FORM_ID = 'form-cambiar-password'

interface Errores {
  actual?: string
  nueva?: string
  confirmar?: string
}

function Formulario({ user, onListo }: { user: Usuario; onListo: () => void }) {
  const toast = useToast()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [errores, setErrores] = useState<Errores>({})

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    const nuevos: Errores = {
      actual: !actual ? 'Escribe tu contraseña actual.' : actual !== user.password ? 'La contraseña actual no es correcta.' : undefined,
      nueva: errorPassword(nueva) ?? (nueva === actual ? 'La nueva contraseña debe ser distinta a la actual.' : undefined),
      confirmar: errorConfirmacion(nueva, confirmar),
    }
    setErrores(nuevos)
    if (hayErrores({ ...nuevos })) return
    mutate((db) => {
      const u = db.usuarios.find((x) => x.id === user.id)
      if (u) u.password = nueva
    })
    toast('Contraseña actualizada')
    onListo()
  }

  return (
    <form id={FORM_ID} onSubmit={guardar} noValidate className="stack">
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
        hint="Mínimo 8 caracteres."
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
    </form>
  )
}

/** Sheet "Cambiar contraseña": pide la actual, la nueva y su confirmación. */
export function CambiarPassword({ open, onClose, user }: { open: boolean; onClose: () => void; user: Usuario }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cambiar contraseña"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID}>
            Guardar
          </Button>
        </>
      }
    >
      <Formulario user={user} onListo={onClose} />
    </Sheet>
  )
}
