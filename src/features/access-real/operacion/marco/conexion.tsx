/*
 * conexion.tsx — Pantalla «Conexión y sincronización» (Figma 08 y 11): estado de la red, lo guardado solo en este teléfono
 * y el espacio usado. La cola (cola-operaciones.ts) envía sola al volver la conexión y cada 30 s; aquí se puede forzar el
 * envío y reintentar o descartar las capturas rechazadas.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Badge, Button, Icono, type NombreIcono } from '@/components/ui'
import { fechaHora } from '@/domain/dates'
import { cn } from '@/lib/cn'
import type { ColaOperaciones } from '../cola-operaciones'

type Captura = ColaOperaciones['capturas'][number]
type Entidad = Captura['operacion']['entidad']

const ENTIDADES: Entidad[] = ['visita', 'necesidad']
const ENTIDAD_TEXTO: Record<Entidad, string> = { visita: 'Visitas', necesidad: 'Necesidades' }
const ENTIDAD_VISUAL: Record<Entidad, { icono: NombreIcono; tono: string }> = {
  visita: { icono: 'calendar_month', tono: 'bg-teal-100 text-teal' },
  necesidad: { icono: 'volunteer_activism', tono: 'bg-warning-100 text-warning-700' },
}

/** Límite de datos que la app guarda en el teléfono (SRS §9.1.1 · RNF-5.2): la barra compara el uso contra este valor. */
const LIMITE_MB = 50
const MB = 1024 * 1024
const decimal = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 1 })

function descripcion({ operacion }: Captura) {
  if (operacion.entidad === 'visita') return operacion.tipo === 'iniciar' ? 'Inicio de visita' : 'Visita'
  return operacion.tipo === 'registrar' ? 'Necesidad' : 'Cambio de estado de una necesidad'
}

const estimacionDisponible = () => typeof navigator !== 'undefined' && typeof navigator.storage?.estimate === 'function'

/** Uso de almacenamiento del origen (`navigator.storage.estimate()`), en MB. `null` mientras mide; `'no-disponible'` si el navegador no lo ofrece. */
function useEspacioUsado(refrescar: unknown): number | null | 'no-disponible' {
  // Sin la API (navegador antiguo o contexto no seguro) la pantalla lo dice en vez de quedarse midiendo.
  const [uso, setUso] = useState<number | null | 'no-disponible'>(() => (estimacionDisponible() ? null : 'no-disponible'))
  useEffect(() => {
    if (!estimacionDisponible()) return
    let vigente = true
    navigator.storage.estimate().then(
      (estimacion) => { if (vigente) setUso(estimacion.usage === undefined ? 'no-disponible' : estimacion.usage / MB) },
      () => { if (vigente) setUso('no-disponible') },
    )
    return () => { vigente = false }
  }, [refrescar])
  return uso
}

function Tarjeta({ icono, titulo, children, tono = 'normal' }: { icono: NombreIcono; titulo: string; children?: ReactNode; tono?: 'normal' | 'aviso' }) {
  return <div className="flex items-start gap-3 rounded-md border border-surface-2 bg-surface p-4 shadow-1">
    <span aria-hidden className={cn('grid size-12 flex-none place-items-center rounded-md', tono === 'aviso' ? 'bg-warning-100 text-warning-700' : 'bg-teal-100 text-teal')}><Icono nombre={icono} /></span>
    <div className="grid min-w-0 flex-1 gap-1">
      <h2 className="text-tarjeta text-ink">{titulo}</h2>
      {children}
    </div>
  </div>
}

function EspacioUsado({ uso }: { uso: number | null | 'no-disponible' }) {
  return <section aria-labelledby="espacio-titulo" className="grid gap-3">
    <h2 id="espacio-titulo" className="text-tarjeta text-ink">Espacio usado en este teléfono</h2>
    {uso === 'no-disponible'
      ? <p role="status" className="rounded-md border border-surface-2 bg-surface p-4 text-ayuda text-ink-2">Tu navegador no informa cuánto espacio usa CuidaRed.</p>
      : <div className="grid gap-2 rounded-md border border-surface-2 bg-surface p-4 shadow-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-cuerpo text-ink">Registros y fotos</span>
          <span className="text-cuerpo font-semibold text-ink">{uso === null ? 'Midiendo…' : `${decimal.format(uso)} de ${LIMITE_MB} MB`}</span>
        </div>
        <div role="progressbar" aria-label="Espacio usado en este teléfono" aria-valuemin={0} aria-valuemax={LIMITE_MB}
          aria-valuenow={uso === null ? undefined : Math.min(LIMITE_MB, Math.round(uso * 10) / 10)}
          aria-valuetext={uso === null ? 'Midiendo' : `${decimal.format(uso)} de ${LIMITE_MB} megabytes`}
          className="h-2 overflow-hidden rounded-pill bg-bg">
          <div className={cn('h-full rounded-pill', uso !== null && uso > LIMITE_MB * 0.9 ? 'bg-danger' : 'bg-teal')}
            style={{ width: `${uso === null ? 0 : Math.min(100, Math.max(2, (uso / LIMITE_MB) * 100))}%` }} />
        </div>
      </div>}
  </section>
}

export function PantallaConexion({ cola, cuentaId, enLinea }: { cola: ColaOperaciones; cuentaId: string; enLinea: boolean }) {
  const propias = cola.capturas.filter((captura) => captura.cuentaId === cuentaId)
  const rechazadas = propias.filter((captura) => captura.rechazada)
  const pendientes = propias.length - rechazadas.length
  const uso = useEspacioUsado(propias.length)
  const mensajes = ENTIDADES.flatMap((entidad) => {
    const texto = cola.mensaje(cuentaId, entidad)
    return texto ? [{ entidad, texto }] : []
  })
  return <div className="grid gap-5">
    {enLinea
      ? <Tarjeta icono="cloud_done" titulo="En línea">
        <p className="text-cuerpo text-ink-2">{propias.length === 0 ? 'Todo está sincronizado. Tus cambios se envían automáticamente.' : 'Tus cambios se envían automáticamente.'}</p>
      </Tarjeta>
      : <Tarjeta icono="wifi" titulo="Sin conexión" tono="aviso">
        <p className="text-cuerpo text-ink-2">Puedes seguir registrando visitas y necesidades: se guardan en este teléfono y se envían cuando vuelva Internet. La información mostrada puede no estar actualizada.</p>
      </Tarjeta>}

    {propias.length > 0 && <section aria-labelledby="pendientes-titulo" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="pendientes-titulo" className="text-tarjeta text-ink">Guardado solo en este teléfono · {propias.length}</h2>
      </div>
      <ul className="divide-y divide-surface-2 overflow-hidden rounded-md border border-surface-2 bg-surface shadow-1">
        {propias.map((captura) => {
          const visual = captura.rechazada ? { icono: 'error' as const, tono: 'bg-danger-100 text-danger' } : ENTIDAD_VISUAL[captura.operacion.entidad]
          return <li key={captura.operacion.id_cliente} className="flex items-center gap-3 p-3">
            <span aria-hidden className={cn('grid size-11 flex-none place-items-center rounded-md', visual.tono)}><Icono nombre={visual.icono} /></span>
            <div className="grid min-w-0 flex-1">
              <p className="text-cuerpo font-semibold text-ink wrap-anywhere">{descripcion(captura)}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-ayuda text-muted">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className={cn('size-2 rounded-full', captura.rechazada ? 'bg-danger' : 'bg-warning')} />
                  {captura.rechazada ? 'Rechazada por el servidor' : 'Pendiente de sincronización'}
                </span>
                <time dateTime={captura.operacion.actualizado_en}>{fechaHora(captura.operacion.actualizado_en)}</time>
              </p>
            </div>
            <Badge tone={captura.rechazada ? 'danger' : 'warning'}>{captura.rechazada ? 'Rechazada' : 'Pendiente'}</Badge>
          </li>
        })}
      </ul>
    </section>}

    <div className="grid gap-3">
      <Button fullWidth icon={<Icono nombre="sync" tamano={20} />} disabled={!enLinea || pendientes === 0} onClick={() => { void cola.sincronizar() }}>Sincronizar ahora</Button>
      {propias.length > 0 && <p className="text-ayuda text-muted">Se enviará solo cuando vuelva la conexión. No borres los datos del navegador mientras haya registros pendientes.</p>}
      {mensajes.map(({ entidad, texto }) => <p key={entidad} role="status" className="rounded-md bg-blue-100 p-3 text-ayuda text-ink">
        <strong>{ENTIDAD_TEXTO[entidad]}:</strong> {texto}
      </p>)}
    </div>

    {rechazadas.length > 0 && <section aria-labelledby="rechazadas-titulo" className="grid gap-3">
      <h2 id="rechazadas-titulo" className="text-tarjeta text-ink">Capturas rechazadas</h2>
      <p className="text-ayuda text-ink-2">El servidor no aceptó estas capturas. Puedes reintentarlas o descartarlas.</p>
      {ENTIDADES.filter((entidad) => rechazadas.some((captura) => captura.operacion.entidad === entidad)).map((entidad) =>
        <div key={entidad} className="flex flex-wrap items-center gap-2">
          <span className="min-w-24 text-cuerpo font-semibold text-ink">{ENTIDAD_TEXTO[entidad]}</span>
          <Button variant="outline" size="sm" disabled={!enLinea} onClick={() => { void cola.reintentar(cuentaId, entidad) }}>Reintentar {ENTIDAD_TEXTO[entidad].toLowerCase()}</Button>
          <Button variant="ghost" onClick={() => { void cola.quitarRechazadas(cuentaId, entidad) }}>Descartar</Button>
        </div>)}
    </section>}

    <EspacioUsado uso={uso} />
  </div>
}
