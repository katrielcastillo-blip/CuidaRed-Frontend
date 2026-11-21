/*
 * MisCuentas.tsx — "Mis cuentas": membresías activas de la persona (cuenta, tipo Familia u Organización y rol) con la
 * actual marcada y el botón "Usar esta cuenta". Solo se muestra si pertenece a más de una cuenta.
 * Módulo: perfil (Reglas de Negocio V2 §Membresía: un usuario puede tener un rol distinto en cada cuenta).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useNavigate } from 'react-router-dom'
import { Building2, Users } from 'lucide-react'
import { Badge, Button, IconTile, useToast } from '@/components/ui'
import { cambiarCuenta, ROL_LABEL, useMisCuentas } from '@/domain/auth'
import { TIPO_CUENTA_LABEL, tipoDeCuenta } from '@/domain/planes'
import { cn } from '@/lib/cn'

export function MisCuentas() {
  const cuentas = useMisCuentas()
  const navigate = useNavigate()
  const toast = useToast()
  if (cuentas.length < 2) return null

  const usar = (membresiaId: string, nombre: string) => {
    const ruta = cambiarCuenta(membresiaId)
    if (!ruta) {
      toast('No se pudo cambiar de cuenta. Vuelve a intentarlo.', 'error')
      return
    }
    toast(`Ahora usas «${nombre}»`)
    navigate(ruta)
  }

  return (
    <section aria-labelledby="mis-cuentas" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="section-title" id="mis-cuentas">
          Mis cuentas
        </h2>
        <p className="text-sm leading-snug text-muted">Perteneces a {cuentas.length} cuentas. En cada una puedes tener un rol distinto.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {cuentas.map(({ membresia, org, activa }) => {
          const tipo = tipoDeCuenta(org)
          const nombre = org?.nombre ?? 'Cuenta sin nombre'
          const Icono = tipo === 'familia' ? Users : Building2
          return (
            <li
              key={membresia.id}
              aria-current={activa || undefined}
              className={cn('flex flex-col gap-3 rounded-md border p-3.5 sm:flex-row sm:items-center', activa ? 'border-navy bg-blue-100' : 'border-line-soft bg-surface')}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <IconTile size={44}>
                  <Icono size={22} aria-hidden />
                </IconTile>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="wrap-anywhere font-semibold leading-snug text-ink">{nombre}</span>
                  <span className="text-sm text-ink-2">
                    {TIPO_CUENTA_LABEL[tipo]} · {ROL_LABEL[membresia.rol]}
                  </span>
                </div>
              </div>
              {activa ? (
                <Badge tone="navy" className="self-start sm:self-center">
                  Cuenta actual
                </Badge>
              ) : (
                <Button variant="outline" size="sm" className="sm:flex-none" aria-label={`Usar esta cuenta: ${nombre}, como ${ROL_LABEL[membresia.rol]}`} onClick={() => usar(membresia.id, nombre)}>
                  Usar esta cuenta
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
