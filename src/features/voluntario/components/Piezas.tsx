/*
 * Piezas.tsx — Piezas del portal del voluntario: ficha mínima del adulto (nombre, dirección y contacto), tarjeta de
 * visita por registrar, aviso de conexión, insignia de sincronización y pantalla "No encontrado".
 * Módulo: voluntario (vista mínima: sin riesgo, condición, indicaciones ni necesidades).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { ArrowRight, CircleUserRound, ClipboardCheck, CloudOff, CloudUpload, MapPin, Phone, RefreshCw } from 'lucide-react'
import { hhmmA12, todayISO } from '@/domain/dates'
import type { Visita } from '@/domain/types'
import { Badge, ButtonLink, Card, EmptyState, IconTile } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { etiquetaDia, telefonoParaLlamar, type FichaAdulto } from '../lib/datos'

/** Marca de los registros guardados solo en el dispositivo (RF-10 · CU-14). */
export function SyncBadge() {
  return (
    <Badge tone="warning">
      <CloudUpload size={11} strokeWidth={3} aria-hidden />
      Pendiente de sincronización
    </Badge>
  )
}

/** Dirección para llegar y contacto principal (con enlace para llamar). Es todo lo que se muestra del adulto. */
export function DatosAdulto({ ficha, className }: { ficha: FichaAdulto; className?: string }) {
  const { contacto } = ficha
  return (
    <ul className={cn('flex flex-col gap-1 m-0 p-0 list-none text-sm text-ink-2', className)}>
      <li className="flex items-start gap-2">
        <MapPin size={18} className="mt-0.5 flex-none text-navy" aria-hidden />
        <span className="min-w-0 wrap-anywhere">
          <span className="sr-only">Dirección: </span>
          {ficha.direccion || 'Sin dirección registrada'}
        </span>
      </li>
      {contacto && (
        <li>
          <a
            href={`tel:${telefonoParaLlamar(contacto.telefono)}`}
            className="inline-flex items-center gap-2 min-h-12 -my-1 font-semibold text-navy underline underline-offset-4"
            aria-label={`Llamar a ${contacto.nombre}, ${contacto.parentesco}, al ${contacto.telefono}`}
          >
            <Phone size={18} className="flex-none" aria-hidden />
            <span className="wrap-anywhere">
              {contacto.nombre} ({contacto.parentesco}) · {contacto.telefono}
            </span>
          </a>
        </li>
      )}
    </ul>
  )
}

/**
 * Visita programada que falta registrar: adulto, día y hora, cómo llegar y el botón grande "Registrar visita".
 * `destacada` (las de hoy) usa el botón sólido; las próximas, el de borde.
 */
export function TarjetaVisita({ visita, ficha, destacada = false }: { visita: Visita; ficha: FichaAdulto; destacada?: boolean }) {
  const { base } = useShell()
  const atrasada = visita.fecha < todayISO()
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <IconTile>
          <CircleUserRound size={26} strokeWidth={1.7} aria-hidden />
        </IconTile>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3 className="text-lg font-semibold leading-tight text-ink wrap-anywhere">{ficha.nombre}</h3>
          <p className="text-base font-semibold text-navy">
            {etiquetaDia(visita.fecha)} · {hhmmA12(visita.horaPautada)}
          </p>
        </div>
      </div>
      {(atrasada || visita.pendienteSync) && (
        <div className="flex flex-wrap gap-2">
          {atrasada && <Badge tone="warning">Sin registrar</Badge>}
          {visita.pendienteSync && <SyncBadge />}
        </div>
      )}
      <DatosAdulto ficha={ficha} />
      <ButtonLink
        variant={destacada ? 'primary' : 'outline'}
        fullWidth
        to={`${base}/visitas/nueva?visita=${visita.id}`}
        icon={<ClipboardCheck size={22} aria-hidden />}
      >
        Registrar visita
      </ButtonLink>
    </Card>
  )
}

/** Aviso de conexión: sin red (se puede seguir registrando) o registros pendientes de enviar. */
export function AvisoConexion({ enLinea, pendientes }: { enLinea: boolean; pendientes: number }) {
  const { base } = useShell()
  const texto = `${pendientes} registro${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de sincronizar`
  if (!enLinea) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-sm border border-warning bg-warning-100 text-ink" role="status">
        <CloudOff size={24} className="text-warning-700 flex-none" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-bold text-warning-700">Sin conexión. Puedes seguir registrando.</p>
          <p className="text-sm">
            Tus visitas se guardan en el dispositivo y se envían solas al volver la conexión{pendientes > 0 && ` (${texto})`}.
          </p>
        </div>
      </div>
    )
  }
  if (pendientes === 0) return null
  return (
    <Link to={`${base}/sincronizacion`} className="flex items-center gap-3 min-h-12 p-4 rounded-sm border border-blue bg-blue-100 text-navy hover:shadow-1" role="status">
      <RefreshCw size={22} className="flex-none" aria-hidden />
      <span className="flex-1 font-semibold">{texto}</span>
      <ArrowRight size={20} aria-hidden />
    </Link>
  )
}

/** Visita o adulto inexistente o fuera de su alcance: mismo mensaje en ambos casos (no revela si existe). */
export function NoEncontrado({ titulo }: { titulo: string }) {
  const { base } = useShell()
  return (
    <Page title={titulo} back>
      <div className="min-h-[40vh] grid place-items-center">
        <EmptyState
          title="No encontrado o sin permiso"
          text="La visita no existe o no tienes acceso a ella."
          action={
            <ButtonLink variant="outline" size="sm" to={base}>
              Ir al inicio
            </ButtonLink>
          }
        />
      </div>
    </Page>
  )
}
