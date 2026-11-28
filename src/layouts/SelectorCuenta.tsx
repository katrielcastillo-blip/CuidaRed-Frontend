/*
 * SelectorCuenta.tsx — Selector de cuenta y rol activo en el encabezado (CR-177 · Reglas de Negocio V2 §Membresía).
 * Módulo: layouts.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Un usuario puede pertenecer a varias cuentas (Familia u Organización) con un rol distinto en cada una. Al elegir
 * otra cuenta se cambia la membresía activa de la sesión: se recargan permisos, menú y datos de esa cuenta y se
 * navega al inicio del rol correspondiente.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Check, ChevronDown, House } from 'lucide-react'
import { cambiarCuenta, nombreCompleto, ROL_LABEL, useMisCuentas, useSession } from '@/domain/auth'
import { TIPO_CUENTA_LABEL, tipoDeCuenta } from '@/domain/planes'
import { Badge, Sheet, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

/** Texto "Rol · Cuenta" del usuario en sesión. */
export function useEtiquetaCuenta() {
  const { user, org } = useSession()
  if (!user) return ''
  return `${ROL_LABEL[user.rol]}${org ? ` · ${org.nombre}` : ''}`
}

/**
 * Botón con el nombre, rol y cuenta del usuario. Si tiene más de una cuenta abre la hoja para cambiar; si no,
 * solo informa. `variante="claro"` para la barra blanca y `"oscuro"` para el menú lateral navy.
 */
export function SelectorCuenta({ variante = 'claro', className }: { variante?: 'claro' | 'oscuro'; className?: string }) {
  const { user, org } = useSession()
  const cuentas = useMisCuentas()
  const navigate = useNavigate()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  if (!user) return null
  const varias = cuentas.length > 1

  const elegir = (membresiaId: string, activa: boolean) => {
    if (activa) return setAbierto(false)
    const destino = cambiarCuenta(membresiaId)
    setAbierto(false)
    if (!destino) return toast('No se pudo cambiar de cuenta. Vuelve a intentarlo.', 'error')
    const nueva = cuentas.find((c) => c.membresia.id === membresiaId)
    toast(`Ahora trabajas en ${nueva?.org?.nombre ?? 'la cuenta elegida'} como ${nueva ? ROL_LABEL[nueva.membresia.rol] : 'miembro'}.`, 'ok')
    navigate(destino, { replace: true })
  }

  const textoCuenta = (
    <>
      <span className={cn('text-sm font-semibold truncate max-w-full', variante === 'claro' ? 'text-ink' : 'text-white')}>{nombreCompleto(user)}</span>
      <span className={cn('text-[11px] truncate max-w-full', variante === 'claro' ? 'text-muted' : 'opacity-80')}>
        {ROL_LABEL[user.rol]}
        {org ? ` · ${org.nombre}` : ''}
      </span>
    </>
  )

  if (!varias) {
    return (
      <span className={cn('flex flex-col items-end leading-tight min-w-0', className)} data-testid="usuario-actual">
        {textoCuenta}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={cn(
          'flex items-center gap-1.5 min-h-12 min-w-0 rounded-md px-2 text-left',
          variante === 'claro' ? 'hover:bg-blue-100' : 'hover:bg-white/10',
          className,
        )}
        aria-haspopup="dialog"
        aria-label={`Cuenta actual: ${org?.nombre ?? ''}, rol ${ROL_LABEL[user.rol]}. Cambiar de cuenta`}
        data-testid="usuario-actual"
      >
        <span className="flex flex-col items-end leading-tight min-w-0">{textoCuenta}</span>
        <ChevronDown size={18} aria-hidden className={cn('flex-none', variante === 'claro' ? 'text-navy' : 'text-blue-100')} />
      </button>
      <Sheet open={abierto} onClose={() => setAbierto(false)} title="Cambiar de cuenta">
        <p className="text-sm text-muted mb-3">Perteneces a varias cuentas. Elige en cuál quieres trabajar: verás sus adultos mayores, tu rol y tus permisos en esa cuenta.</p>
        <ul className="flex flex-col gap-2" data-testid="lista-cuentas">
          {cuentas.map(({ membresia, org: o, activa }) => {
            const tipo = tipoDeCuenta(o)
            const Icono = tipo === 'familia' ? House : Building2
            return (
              <li key={membresia.id}>
                <button
                  type="button"
                  onClick={() => elegir(membresia.id, activa)}
                  aria-current={activa ? 'true' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 min-h-14 rounded-md border text-left',
                    activa ? 'border-navy bg-blue-100' : 'border-line-soft bg-surface hover:bg-blue-100/50',
                  )}
                >
                  <span className="grid place-items-center size-10 flex-none rounded-full bg-white text-navy border border-line-soft">
                    <Icono size={20} aria-hidden />
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col">
                    <strong className="text-ink truncate">{o?.nombre ?? 'Cuenta'}</strong>
                    <span className="text-sm text-muted">{ROL_LABEL[membresia.rol]}</span>
                  </span>
                  <Badge tone={tipo === 'familia' ? 'info' : 'neutral'}>{TIPO_CUENTA_LABEL[tipo]}</Badge>
                  {activa && <Check size={20} className="text-navy flex-none" aria-label="Cuenta actual" />}
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </>
  )
}
