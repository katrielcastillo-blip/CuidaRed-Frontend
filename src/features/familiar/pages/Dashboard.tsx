/*
 * Dashboard.tsx — Inicio del FAMILIAR RESPONSABLE (SRS §13.1 "Módulo de consulta restringida"): "Mis
 * envejecientes", solo los adultos mayores con permiso explícito (vínculo "familiar_responsable") EN LA CUENTA
 * ACTIVA, con tarjetas de seguimiento: última visita realizada, próxima visita, necesidades abiertas y estado
 * general. Si no tiene ninguno autorizado se explica por qué y qué hacer. Los datos llegan del hook
 * `useEnvejecientesFamiliar` (hoy el store local; mañana GET /familiar/envejecientes). Solo lectura
 * (RF-09 · §8.2.2.3.4 c · Reglas de Negocio V2 §Vínculo).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { Page } from '@/layouts/AppShell'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { EmptyState, SearchInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { SeguimientoCard } from '../components/SeguimientoCard'
import { SinDatos } from '../components/SinDatos'
import { useCuentaActivaFamiliar, useEnvejecientesFamiliar } from '../lib/datos'
import { normaliza } from '../lib/etiquetas'

export default function Dashboard() {
  const user = useUser()
  const enLinea = useEnLinea()
  const cuenta = useCuentaActivaFamiliar()
  const consulta = useEnvejecientesFamiliar()
  const [q, setQ] = useState('')

  const envejecientes = useMemo(() => (consulta.estado === 'listo' ? consulta.datos : []), [consulta])
  const visibles = useMemo(() => {
    const t = normaliza(q.trim())
    return t ? envejecientes.filter((e) => normaliza(e.nombre).includes(t)) : envejecientes
  }, [envejecientes, q])

  const totalAbiertas = envejecientes.reduce((n, e) => n + e.seguimiento.necesidadesAbiertasTotal, 0)
  const totalProximas = envejecientes.filter((e) => e.seguimiento.proximaVisita).length

  return (
    <Page title="Inicio" wide>
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.75rem] font-bold leading-tight text-ink">Hola, {user.nombre}</h2>
        <span className="inline-flex items-center gap-2 text-sm text-ink-2">
          <span className={cn('size-2 rounded-full', enLinea ? 'bg-green' : 'bg-warning')} aria-hidden />
          {enLinea ? 'En línea' : 'Sin conexión: ves la última información guardada'}
        </span>
        {cuenta && (
          <span className="text-sm text-ink-2">
            Cuenta activa: <strong className="text-ink">{cuenta.nombre}</strong>
          </span>
        )}
      </div>

      <p className="flex items-start gap-2 p-3 rounded-sm bg-blue-100 border border-blue text-sm text-ink">
        <Eye size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
        <span>
          Aquí consultas cómo va el seguimiento de {envejecientes.length === 1 ? 'tu familiar' : 'tus familiares'}: visitas recibidas, próximas visitas,
          necesidades, indicaciones médicas y contactos de emergencia. Es solo de consulta; si algo no está bien, contacta al equipo de la cuenta.
          {cuenta?.variasCuentas && ` Solo ves a quienes te autorizaron en ${cuenta.nombre}.`}
        </span>
      </p>

      {envejecientes.length > 1 && (
        <section aria-label="Resumen" className="grid grid-cols-3 gap-3">
          <Resumen label="Autorizados" valor={envejecientes.length} />
          <Resumen label="Necesidades abiertas" valor={totalAbiertas} />
          <Resumen label="Con visita programada" valor={totalProximas} />
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="mis-envejecientes">
        <h2 id="mis-envejecientes" className="text-xl font-bold text-ink">
          Mis envejecientes
        </h2>
        {envejecientes.length > 3 && <SearchInput value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar adulto mayor" placeholder="Buscar por nombre..." />}

        {consulta.estado !== 'listo' ? (
          <SinDatos consulta={consulta} />
        ) : visibles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((e) => (
              <SeguimientoCard key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={envejecientes.length ? 'Sin resultados' : 'Aún no tienes envejecientes autorizados'}
            text={
              envejecientes.length
                ? `Nadie coincide con «${q.trim()}».`
                : `Solo puedes ver a los adultos mayores para los que la persona que gestiona la cuenta te dio permiso explícito${cuenta ? ` en ${cuenta.nombre}` : ''}. Cuando te autoricen, aparecerán aquí.${cuenta?.variasCuentas ? ' Si tienes acceso en otra cuenta, cámbiala desde el selector de cuenta.' : ''}`
            }
          />
        )}
      </section>
    </Page>
  )
}

function Resumen({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex flex-col justify-between gap-1 min-w-0 min-h-[72px] px-3 py-2 rounded-sm bg-surface border border-line-soft">
      <span className="text-xs font-semibold leading-tight text-muted">{label}</span>
      <span className="text-2xl font-bold leading-none text-ink">{valor}</span>
    </div>
  )
}
