/*
 * CambiarPassword.tsx — Panel "Cambiar contraseña": verifica la actual, aplica la política de contraseñas robustas
 * con la lista de requisitos marcándose en vivo y confirma el éxito.
 * Módulo: perfil (CU-01 · RF-1.4 · SRS §8.2.2.3.5 b · servicio cambiarPassword de @/domain/api).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { Button, PasswordField, requerido, Sheet, useFormulario, useToast } from '@/components/ui'
import { cambiarPassword } from '@/domain/api'
import { useEnLinea } from '@/domain/conectividad'
import { REGLAS_PASSWORD } from '@/domain/seguridad'
import type { Usuario } from '@/domain/types'
import { Aviso, RequisitosPassword } from '@/features/auth/components/Piezas'
import { errorConfirmacion } from '@/features/auth/lib/validar'

const FORM_ID = 'form-cambiar-password'

interface DatosPassword {
  actual: string
  nueva: string
  confirmar: string
}

const VACIO: DatosPassword = { actual: '', nueva: '', confirmar: '' }

/** Las contraseñas nunca se guardan como borrador. */
const NO_GUARDAR: Array<keyof DatosPassword> = ['actual', 'nueva', 'confirmar']

function Formulario({ user, onListo, onCargando }: { user: Usuario; onListo: () => void; onCargando: (v: boolean) => void }) {
  const toast = useToast()
  const enLinea = useEnLinea()
  const [general, setGeneral] = useState<string>()

  const f = useFormulario<DatosPassword>({
    clave: `password:${user.id}`,
    inicial: VACIO,
    excluirDeBorrador: NO_GUARDAR,
    reglas: {
      actual: requerido('Escribe tu contraseña actual.'),
      nueva: (v, todos) =>
        !v
          ? 'Escribe la nueva contraseña.'
          : !REGLAS_PASSWORD.every((r) => r.ok(v))
            ? 'La contraseña aún no cumple todos los requisitos de la lista.'
            : v === todos.actual
              ? 'La nueva contraseña debe ser distinta de la actual.'
              : undefined,
      confirmar: (v, todos) => errorConfirmacion(todos.nueva, v),
    },
  })

  const enviar = f.enviar(async (v) => {
    setGeneral(undefined)
    onCargando(true)
    try {
      const res = await cambiarPassword(user, v.actual, v.nueva)
      if (res.ok) {
        toast('Contraseña actualizada')
        onListo()
      } else if (!res.errores) {
        setGeneral(res.error)
      }
      return res
    } finally {
      onCargando(false)
    }
  })

  return (
    <form id={FORM_ID} onSubmit={enviar} noValidate className="flex flex-col gap-4" aria-busy={f.enviando || undefined}>
      {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para cambiar tu contraseña. Lo que escribas se conserva en este panel.</Aviso>}
      <PasswordField
        label="Contraseña actual"
        autoComplete="current-password"
        help="La pedimos para confirmar que eres tú quien hace el cambio."
        {...f.campo('actual')}
      />
      <PasswordField label="Nueva contraseña" autoComplete="new-password" {...f.campo('nueva')} />
      <PasswordField label="Confirmar nueva contraseña" autoComplete="new-password" {...f.campo('confirmar')} />
      <RequisitosPassword password={f.valores.nueva} confirmar={f.valores.confirmar} />
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
