/*
 * MisVisitas.tsx — Visitas del voluntario: las programadas por registrar y el historial de las que ya registró
 * (fecha, adulto y observación).
 * Módulo: voluntario (V2 §Visita: sin estado del adulto, aspectos, necesidades ni datos médicos).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { ClipboardPlus } from 'lucide-react'
import { useUser } from '@/domain/auth'
import { hhmmA12, hora12, todayISO } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import type { Visita } from '@/domain/types'
import { ButtonLink, Card, EmptyState, Segmented } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { SyncBadge, TarjetaVisita } from '../components/Piezas'
import { etiquetaDia, observacionPropia, useMisAdultos, useMisVisitas, type FichaAdulto } from '../lib/datos'

type Pestana = 'programadas' | 'registradas'

export function MisVisitas() {
  const user = useUser()
  const { base } = useShell()
  const adultos = useMisAdultos()
  const { programadas, registradas, fichaDe } = useMisVisitas()
  const [pestana, setPestana] = useState<Pestana>('programadas')
  const puedeRegistrar = puede(user, 'visitas:registrar')
  const hoy = todayISO()

  return (
    <Page title="Mis visitas" wide>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-[440px]">
          <Segmented<Pestana>
            label="Mis visitas"
            value={pestana}
            onChange={setPestana}
            options={[
              { value: 'programadas', label: `Programadas (${programadas.length})` },
              { value: 'registradas', label: `Registradas (${registradas.length})` },
            ]}
          />
        </div>
        {puedeRegistrar && adultos.length > 0 && (
          <ButtonLink variant="soft" size="sm" to={`${base}/visitas/nueva`} icon={<ClipboardPlus size={20} aria-hidden />}>
            Registrar visita no programada
          </ButtonLink>
        )}
      </div>

      {pestana === 'programadas' ? (
        programadas.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" role="tabpanel">
            {programadas.map((v) => {
              const ficha = fichaDe(v)
              return ficha ? <TarjetaVisita key={v.id} visita={v} ficha={ficha} destacada={v.fecha <= hoy} /> : null
            })}
          </div>
        ) : (
          <EmptyState title="No tienes visitas programadas" text="Cuando el coordinador programe una visita, aparecerá aquí." />
        )
      ) : registradas.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" role="tabpanel">
          {registradas.map((v) => {
            const ficha = fichaDe(v)
            return ficha ? <TarjetaRegistrada key={v.id} visita={v} ficha={ficha} propia={observacionPropia(v, user.id)} /> : null
          })}
        </div>
      ) : (
        <EmptyState title="Aún no has registrado visitas" text="Tus visitas registradas aparecerán aquí con su observación." />
      )}
    </Page>
  )
}

/** Visita ya registrada: fecha y hora, adulto y la observación que dejó el voluntario. */
function TarjetaRegistrada({ visita, ficha, propia }: { visita: Visita; ficha: FichaAdulto; propia: boolean }) {
  const observacion = visita.observaciones?.trim()
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg font-semibold leading-tight text-ink wrap-anywhere">{ficha.nombre}</h3>
        <p className="text-base font-semibold text-navy">
          {etiquetaDia(visita.fecha)} · {visita.inicio ? hora12(visita.inicio) : hhmmA12(visita.horaPautada)}
        </p>
      </div>
      {visita.pendienteSync && <SyncBadge />}
      {propia ? (
        <p className="p-3 rounded-sm bg-surface-2/60 text-base text-ink-2 whitespace-pre-wrap wrap-anywhere">{observacion || 'Sin observación.'}</p>
      ) : (
        <p className="p-3 rounded-sm bg-surface-2/60 text-sm text-muted">Esta visita la registró otra persona del equipo.</p>
      )}
    </Card>
  )
}
