/*
 * Dashboard.tsx — Inicio del FAMILIAR RESPONSABLE (SRS §13.1 "Módulo de consulta restringida"): solo los
 * adultos mayores con los que tiene vínculo "familiar_responsable" (Vinculo · adultosVisibles) con el estado
 * de su seguimiento: tipo de vínculo, última y próxima visita (con su motivo, Visit_razon; incluye visitas en
 * las que el adulto es adulto adicional del hogar) y necesidades abiertas con su prioridad. El umbral de días
 * sin visita sale de Configuracion_Cuenta (configOrg). Solo lectura (RF-09 · §8.2.2.3.4 c).
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { Page } from '@/layouts/AppShell'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { diasSinVisita, ultimaVisitaCompletada } from '@/domain/reglas'
import { useDB } from '@/domain/store'
import { EmptyState, SearchInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { SeguimientoCard, type Seguimiento } from '../components/SeguimientoCard'
import { necesidadAbierta, normaliza, proximasVisitas, useAdultosFamilia, useUmbralSinVisita } from '../lib'

export default function Dashboard() {
  const user = useUser()
  const enLinea = useEnLinea()
  const adultos = useAdultosFamilia()
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const vinculos = useDB((s) => s.vinculos)
  const tiposVinculo = useDB((s) => s.catalogos.tiposVinculo)
  const [q, setQ] = useState('')
  const umbral = useUmbralSinVisita()

  // Seguimiento de cada adulto; primero los que llevan más días sin visita.
  const seguimientos = useMemo<Seguimiento[]>(
    () =>
      adultos
        .filter((a) => a.estado === 'activo')
        .map((a) => {
          const { dias, conVisitas } = diasSinVisita({ visitas }, a)
          return {
            adulto: a,
            ultima: ultimaVisitaCompletada(visitas, a.id),
            dias,
            conVisitas,
            proxima: proximasVisitas(visitas, a.id)[0],
            abiertas: necesidades
              .filter((n) => n.adultoId === a.id && necesidadAbierta(n.estado))
              .sort((x, y) => y.creadaEn.localeCompare(x.creadaEn)),
          }
        })
        .sort((x, y) => y.dias - x.dias || nombreCompleto(x.adulto).localeCompare(nombreCompleto(y.adulto), 'es')),
    [adultos, visitas, necesidades],
  )

  const visibles = useMemo(() => {
    const t = normaliza(q.trim())
    return t ? seguimientos.filter((s) => normaliza(nombreCompleto(s.adulto)).includes(t)) : seguimientos
  }, [seguimientos, q])

  const totalAbiertas = seguimientos.reduce((n, s) => n + s.abiertas.length, 0)
  const totalProximas = seguimientos.filter((s) => s.proxima).length
  /** Tipo de vínculo del usuario con el adulto (Tipo_vinculo). */
  const vinculoCon = (adultoId: string) => {
    const v = vinculos.find((x) => x.adultoId === adultoId && x.usuarioId === user.id)
    return v ? (tiposVinculo.find((t) => t.id === v.tipoVinculoId)?.nombre ?? 'Familiar responsable') : undefined
  }

  return (
    <Page title="Inicio" wide>
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.75rem] font-bold leading-tight text-ink">Hola, {user.nombre}</h2>
        <span className="inline-flex items-center gap-2 text-sm text-ink-2">
          <span className={cn('size-2 rounded-full', enLinea ? 'bg-green' : 'bg-warning')} aria-hidden />
          {enLinea ? 'En línea' : 'Sin conexión: ves la última información guardada'}
        </span>
      </div>

      <p className="flex items-start gap-2 p-3 rounded-sm bg-blue-100 border border-blue text-sm text-ink">
        <Eye size={18} className="flex-none mt-0.5 text-navy" aria-hidden />
        <span>
          Aquí puedes consultar cómo va el seguimiento de {seguimientos.length === 1 ? 'tu familiar' : 'tus familiares'}: visitas recibidas, próximas
          visitas, necesidades y contactos de emergencia. Es solo de consulta; si algo no está bien, contacta a la organización.
        </span>
      </p>

      {seguimientos.length > 1 && (
        <section aria-label="Resumen" className="grid grid-cols-3 gap-3">
          <Resumen label="A tu cargo" valor={seguimientos.length} />
          <Resumen label="Necesidades abiertas" valor={totalAbiertas} />
          <Resumen label="Con visita programada" valor={totalProximas} />
        </section>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="mis-familiares">
        <h2 id="mis-familiares" className="text-xl font-bold text-ink">
          Estado del seguimiento
        </h2>
        {seguimientos.length > 3 && <SearchInput value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar adulto mayor" placeholder="Buscar por nombre..." />}

        {visibles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibles.map((s) => (
              <SeguimientoCard key={s.adulto.id} s={s} umbral={umbral} vinculo={vinculoCon(s.adulto.id)} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={seguimientos.length ? 'Sin resultados' : 'Aún no hay adultos mayores a tu cargo'}
            text={
              seguimientos.length
                ? `Nadie coincide con «${q.trim()}».`
                : 'Cuando la organización te asigne como familiar responsable de un adulto mayor, aparecerá aquí.'
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
