/*
 * Sincronizacion.tsx — Estado de conexión, instalación de la app, registros pendientes de sincronización
 * (con sus reintentos), resultado de la última sincronización (incluidos conflictos Last-Write-Wins) y uso del
 * almacenamiento local frente al límite de 50 MB.
 * Módulo: sistema (RF-10 · CU-14 · SRS §9.1.1 y §13.2).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect, useState } from 'react'
import { Cloud, CloudOff, HardDrive, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useSession } from '@/domain/auth'
import { setSimularSinConexion, useEnLinea, useSimulacionSinConexion } from '@/domain/conectividad'
import { fechaHora, hora12 } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { descartarPendiente, estaDetenida, MAX_INTENTOS, setSimularFalloSync, simulandoFalloSync, sincronizar, useEstadoSync, usePendientes } from '@/domain/sync'
import type { Necesidad, Visita } from '@/domain/types'
import { Badge, Button, Card, EmptyState, Switch } from '@/components/ui'
import { InstalarApp } from '@/components/pwa/InstalarApp'
import { Page } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'

/** Límite de almacenamiento de la app en el dispositivo (SRS §9.1.1 · RNF-5.2). */
const LIMITE_MB = 50
const MB = 1024 * 1024

/** Nombres legibles de lo que Chrome desglosa en `usageDetails` (otros navegadores no lo informan). */
const PARTES: Record<string, string> = {
  caches: 'Programa de la app (caché)',
  indexedDB: 'Registros guardados en el dispositivo',
  serviceWorkerRegistrations: 'Service Worker',
}

interface Almacenamiento {
  usoMB: number
  cuotaMB: number | null
  partes: Array<{ nombre: string; mb: number }>
}

/** Uso de almacenamiento del origen según `navigator.storage.estimate()`; se vuelve a medir cuando cambia `refrescar`. */
function useAlmacenamiento(refrescar: unknown): Almacenamiento | null {
  const [valor, setValor] = useState<Almacenamiento | null>(null)
  useEffect(() => {
    let vivo = true
    const estimar = navigator.storage?.estimate
    if (!estimar) return
    estimar
      .call(navigator.storage)
      .then((e) => {
        if (!vivo || e.usage === undefined) return
        const detalle = (e as StorageEstimate & { usageDetails?: Record<string, number> }).usageDetails ?? {}
        const partes = Object.entries(detalle)
          .filter(([, bytes]) => bytes >= 0.01 * MB)
          .map(([clave, bytes]) => ({ nombre: PARTES[clave] ?? clave, mb: bytes / MB }))
        setValor({ usoMB: e.usage / MB, cuotaMB: e.quota ? e.quota / MB : null, partes })
      })
      .catch(() => vivo && setValor(null))
    return () => {
      vivo = false
    }
  }, [refrescar])
  return valor
}

function Resumen({ valor, etiqueta, peligro }: { valor: number; etiqueta: string; peligro?: boolean }) {
  return (
    <div className="rounded-sm bg-surface-2 py-2 text-center">
      <p className={cn('text-2xl font-bold leading-tight', peligro && valor > 0 && 'text-danger')}>{valor}</p>
      <p className="text-xs text-muted">{etiqueta}</p>
    </div>
  )
}

export default function Sincronizacion() {
  const { user } = useSession()
  const enLinea = useEnLinea()
  const simulado = useSimulacionSinConexion()
  const pendientes = usePendientes()
  const { sincronizando, ultimo } = useEstadoSync()
  const adultos = useDB((s) => s.adultos)
  const almacen = useAlmacenamiento(`${ultimo?.fecha}|${pendientes.length}`)
  const [falloSimulado, setFallo] = useState(simulandoFalloSync)
  const usaOffline = puede(user, 'sync:usar')

  const nombreAdulto = (id: string) => {
    const a = adultos.find((x) => x.id === id)
    return a ? `${a.nombre} ${a.apellido}` : 'Adulto mayor'
  }
  const usoMB = almacen?.usoMB ?? null
  const cercaDelLimite = usoMB !== null && usoMB > LIMITE_MB * 0.9
  const detenidas = pendientes.filter(estaDetenida).length

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

      <InstalarApp />

      {usaOffline && (
        <section className="flex flex-col gap-3" aria-labelledby="t-pendientes">
          <div className="flex items-center justify-between gap-3">
            <h2 id="t-pendientes" className="section-title">
              Pendientes de sincronización ({pendientes.length})
            </h2>
            <Button size="sm" icon={<RefreshCw size={18} aria-hidden />} loading={sincronizando} disabled={!enLinea || pendientes.length === 0} onClick={() => void sincronizar({ manual: true })}>
              Sincronizar ahora
            </Button>
          </div>
          {detenidas > 0 && (
            <p className="text-sm text-danger flex items-start gap-2" role="alert">
              <TriangleAlert size={16} className="flex-none mt-0.5" aria-hidden />
              <span>
                {detenidas === 1 ? 'Un registro agotó' : `${detenidas} registros agotaron`} los reintentos automáticos. Toca «Sincronizar ahora» para intentarlo de nuevo o descártalo.
              </span>
            </p>
          )}
          {pendientes.length === 0 ? (
            <EmptyState title="Todo está sincronizado" text="No hay registros guardados solo en este dispositivo." />
          ) : (
            <ul className="flex flex-col gap-2" data-testid="lista-pendientes">
              {pendientes.map((p) => (
                <li key={p.id}>
                  <Card className="flex flex-col gap-3 md:flex-row md:items-start">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone="warning">Pendiente de sincronización</Badge>
                        <Badge tone="info">{p.entidad === 'visita' ? 'Visita' : 'Necesidad'} · {p.tipo === 'crear' ? 'nueva' : 'modificada'}</Badge>
                        {estaDetenida(p) && <Badge tone="danger">Reintentos agotados</Badge>}
                      </span>
                      <strong>{nombreAdulto((p.datos as Visita | Necesidad).adultoId)}</strong>
                      <span className="text-sm text-muted">Capturado el {fechaHora(p.actualizadoEn)}</span>
                      {p.ultimoError && (
                        <span className="text-sm text-danger flex items-center gap-1">
                          <TriangleAlert size={14} className="flex-none" aria-hidden /> {p.ultimoError} ({p.intentos} de {MAX_INTENTOS} intentos)
                        </span>
                      )}
                      {p.proximoIntentoEn && !estaDetenida(p) && <span className="text-sm text-muted">Próximo reintento automático: {hora12(p.proximoIntentoEn)}</span>}
                    </div>
                    {p.ultimoError && (
                      <Button size="sm" variant="danger-soft" className="self-start" icon={<Trash2 size={16} aria-hidden />} onClick={() => void descartarPendiente(p.id)}>
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
          <Card data-testid="ultimo-resultado" aria-live="polite">
            <p className="text-sm text-muted">{fechaHora(ultimo.fecha)}</p>
            <p className="font-semibold">{ultimo.sincronizados} registro(s) enviado(s) al servidor.</p>
            <div className="grid grid-cols-3 gap-2 my-2">
              <Resumen valor={ultimo.sincronizados} etiqueta="Enviados" />
              <Resumen valor={ultimo.conflictos.length} etiqueta="Conflictos" />
              <Resumen valor={ultimo.errores.length} etiqueta="Con error" peligro />
            </div>
            {!!ultimo.duplicados && <p className="text-sm text-muted">{ultimo.duplicados} ya estaba(n) en el servidor y no se duplicaron.</p>}
            {!!ultimo.restantes && <p className="text-sm text-muted">Quedan {ultimo.restantes} registro(s) pendientes en este dispositivo.</p>}
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
                    <li key={e.registroId}>
                      {e.motivo}
                      {e.detenida ? ' Se agotaron los reintentos automáticos.' : e.intentos ? ` Se reintentará (intento ${e.intentos} de ${MAX_INTENTOS}).` : ''}
                    </li>
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
        <Card className="flex items-start gap-3">
          <HardDrive size={24} className="text-navy flex-none mt-0.5" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-sm" data-testid="uso-almacenamiento">
              {usoMB === null ? 'No disponible en este navegador.' : `${usoMB.toFixed(1)} MB usados de ${LIMITE_MB} MB permitidos para la app.`}
            </p>
            {usoMB !== null && (
              <div className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden" role="meter" aria-valuemin={0} aria-valuemax={LIMITE_MB} aria-valuenow={Number(usoMB.toFixed(1))} aria-label="Uso de almacenamiento">
                <span className={cn('block h-full', cercaDelLimite ? 'bg-danger' : 'bg-teal')} style={{ width: `${Math.min(100, (usoMB / LIMITE_MB) * 100)}%` }} />
              </div>
            )}
            {cercaDelLimite && <p className="mt-2 text-sm text-danger">Estás cerca del límite. Sincroniza los registros pendientes para liberar espacio.</p>}
            {almacen && almacen.partes.length > 0 && (
              <ul className="mt-2 text-sm text-muted">
                {almacen.partes.map((p) => (
                  <li key={p.nombre}>
                    {p.nombre}: {p.mb.toFixed(1)} MB
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm text-muted">En la caché solo se guarda el programa de la app. Los datos de visitas y necesidades se guardan aparte y se borran del dispositivo al sincronizarse.</p>
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
