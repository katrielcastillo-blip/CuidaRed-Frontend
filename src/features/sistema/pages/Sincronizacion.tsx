/*
 * Sincronizacion.tsx — Estado de conexión, registros pendientes de sincronización, resultado de la última
 * sincronización (incluidos conflictos Last-Write-Wins) y uso del almacenamiento local.
 * Módulo: sistema (RF-10 · CU-14 · SRS §9.1.1 y §13.2).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react'
import { Cloud, CloudOff, HardDrive, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useSession } from '@/domain/auth'
import { setSimularSinConexion, useEnLinea, useSimulacionSinConexion } from '@/domain/conectividad'
import { fechaHora } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { descartarPendiente, setSimularFalloSync, simulandoFalloSync, sincronizar, useEstadoSync, usePendientes } from '@/domain/sync'
import type { Necesidad, Visita } from '@/domain/types'
import { Badge, Button, Card, EmptyState, Switch } from '@/components/ui'
import { Page } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'

const LIMITE_MB = 50

function useAlmacenamiento() {
  const [uso, setUso] = useState<number | null>(null)
  useEffect(() => {
    let vivo = true
    navigator.storage
      ?.estimate?.()
      .then((e) => vivo && setUso(e.usage ?? null))
      .catch(() => setUso(null))
    return () => {
      vivo = false
    }
  }, [])
  return uso
}

export default function Sincronizacion() {
  const { user } = useSession()
  const enLinea = useEnLinea()
  const simulado = useSimulacionSinConexion()
  const pendientes = usePendientes()
  const { sincronizando, ultimo } = useEstadoSync()
  const adultos = useDB((s) => s.adultos)
  const uso = useAlmacenamiento()
  const [falloSimulado, setFallo] = useState(simulandoFalloSync)
  const usaOffline = puede(user, 'sync:usar')

  const nombreAdulto = (id: string) => {
    const a = adultos.find((x) => x.id === id)
    return a ? `${a.nombre} ${a.apellido}` : 'Adulto mayor'
  }
  const usoMB = uso === null ? null : uso / 1024 / 1024

  return (
    <Page title="Conexión y sincronización" back>
      <Card className={cn('flex items-center gap-4', enLinea ? 'bg-success-100 border-success' : 'bg-warning-100 border-warning')}>
        {enLinea ? <Cloud size={32} className="text-success-700 flex-none" aria-hidden /> : <CloudOff size={32} className="text-warning-700 flex-none" aria-hidden />}
        <div className="flex-1">
          <p className="font-bold text-lg" data-testid="estado-conexion">
            {enLinea ? 'Conectado' : 'Sin conexión'}
          </p>
          <p className="text-sm text-ink-2">
            {enLinea
              ? 'Los cambios se guardan directamente en el servidor.'
              : usaOffline
                ? 'Puedes seguir registrando visitas y necesidades: se guardarán en este dispositivo y se enviarán solas al volver la conexión.'
                : 'Puedes consultar la información cargada. Para hacer cambios necesitas conexión.'}
          </p>
        </div>
      </Card>

      {usaOffline && (
        <section className="flex flex-col gap-3" aria-labelledby="t-pendientes">
          <div className="flex items-center justify-between gap-3">
            <h2 id="t-pendientes" className="section-title">
              Pendientes de sincronización ({pendientes.length})
            </h2>
            <Button size="sm" icon={<RefreshCw size={18} aria-hidden />} loading={sincronizando} disabled={!enLinea || pendientes.length === 0} onClick={() => void sincronizar()}>
              Sincronizar ahora
            </Button>
          </div>
          {pendientes.length === 0 ? (
            <EmptyState title="Todo está sincronizado" text="No hay registros guardados solo en este dispositivo." />
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-pendientes">
              {pendientes.map((p) => (
                <li key={p.id}>
                  <Card className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="warning">Pendiente de sincronización</Badge>
                        <Badge tone="info">{p.entidad === 'visita' ? 'Visita' : 'Necesidad'} · {p.tipo === 'crear' ? 'nueva' : 'modificada'}</Badge>
                      </span>
                      <strong>{nombreAdulto((p.datos as Visita | Necesidad).adultoId)}</strong>
                      <span className="text-sm text-muted">Capturado el {fechaHora(p.actualizadoEn)}</span>
                      {p.ultimoError && (
                        <span className="text-sm text-danger flex items-center gap-1">
                          <TriangleAlert size={14} aria-hidden /> {p.ultimoError} ({p.intentos} intento{p.intentos === 1 ? '' : 's'})
                        </span>
                      )}
                    </div>
                    {p.ultimoError && (
                      <Button size="sm" variant="danger-soft" icon={<Trash2 size={16} aria-hidden />} onClick={() => void descartarPendiente(p.id)}>
                        Descartar
                      </Button>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {usaOffline && ultimo && (
        <section className="flex flex-col gap-2" aria-labelledby="t-ultimo">
          <h2 id="t-ultimo" className="section-title">
            Última sincronización
          </h2>
          <Card data-testid="ultimo-resultado">
            <p className="text-sm text-muted">{fechaHora(ultimo.fecha)}</p>
            <p className="font-semibold">{ultimo.sincronizados} registro(s) enviado(s) al servidor.</p>
            {ultimo.conflictos.length > 0 && (
              <div className="mt-2">
                <p className="font-semibold">Conflictos resueltos ("última escritura gana", marca de tiempo UTC):</p>
                <ul className="list-disc pl-5 text-sm">
                  {ultimo.conflictos.map((c) => (
                    <li key={c.registroId}>
                      {c.entidad === 'visita' ? 'Visita' : 'Necesidad'} {c.registroId}: se conservó la versión {c.gana === 'local' ? 'de este dispositivo' : 'del servidor (más reciente)'}.
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ultimo.errores.length > 0 && (
              <div className="mt-2 text-danger">
                <p className="font-semibold">No se pudieron sincronizar {ultimo.errores.length} registro(s):</p>
                <ul className="list-disc pl-5 text-sm">
                  {ultimo.errores.map((e) => (
                    <li key={e.registroId}>{e.motivo}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="t-almacen">
        <h2 id="t-almacen" className="section-title">
          Almacenamiento en este dispositivo
        </h2>
        <Card className="flex items-center gap-3">
          <HardDrive size={24} className="text-navy flex-none" aria-hidden />
          <div className="flex-1">
            <p className="text-sm">{usoMB === null ? 'No disponible en este navegador.' : `${usoMB.toFixed(1)} MB usados de ${LIMITE_MB} MB permitidos para la app.`}</p>
            {usoMB !== null && (
              <div className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={LIMITE_MB} aria-valuenow={Number(usoMB.toFixed(1))} aria-label="Uso de almacenamiento">
                <span className={cn('block h-full', usoMB > LIMITE_MB * 0.9 ? 'bg-danger' : 'bg-teal')} style={{ width: `${Math.min(100, (usoMB / LIMITE_MB) * 100)}%` }} />
              </div>
            )}
          </div>
        </Card>
      </section>

      {usaOffline && (
        <section className="flex flex-col gap-2" aria-labelledby="t-pruebas">
          <h2 id="t-pruebas" className="section-title">
            Modo de práctica
          </h2>
          <Card className="flex flex-col gap-2">
            <Switch
              label="Simular sin conexión en este dispositivo"
              checked={simulado}
              onChange={(v) => setSimularSinConexion(v)}
            />
            <p className="text-sm text-muted">Útil para capacitaciones: la app se comporta como si no hubiera internet, sin apagar el Wi-Fi.</p>
            <Switch
              label="Simular error del servidor al sincronizar"
              checked={falloSimulado}
              onChange={(v) => {
                setSimularFalloSync(v)
                setFallo(v)
              }}
            />
          </Card>
        </section>
      )}
    </Page>
  )
}
