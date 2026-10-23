/*
 * AlertaCard.tsx — Tarjeta de alerta del panel del coordinador: borde y etiqueta por urgencia, adulto,
 * descripción y categoría. Enlaza al detalle de la alerta (CU-09 · CU-10).
 * Módulo: coordinador.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui'
import { nombreCompleto } from '@/domain/auth'
import type { Adulto, Alerta, SeveridadAlerta } from '@/domain/types'
import { cn } from '@/lib/cn'
import { haceTiempo, nombreCorto } from '../lib/datos'

const ESTILO: Record<SeveridadAlerta, { borde: string; sev: string; cat: string; label: string }> = {
  alta: { borde: 'shadow-[inset_4px_0_0_#bb1919]', sev: 'bg-[#ffdbd7] text-[#9b1414]', cat: 'bg-[#ced8f7] text-[#002a70]', label: 'Alta' },
  media: { borde: 'shadow-[inset_4px_0_0_#0060a8]', sev: 'bg-[#fddba4] text-[#5d4000]', cat: 'bg-[#cee2fe] text-[#00508c]', label: 'Media' },
  baja: { borde: 'shadow-[inset_4px_0_0_#00362a]', sev: 'bg-[#80f5d6] text-[#00362b]', cat: 'bg-[#66dabe] text-[#00362b]', label: 'Baja' },
}

export function AlertaCard({ alerta, adulto, to }: { alerta: Alerta; adulto: Adulto; to: string }) {
  const e = ESTILO[alerta.severidad]
  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col gap-3 p-4 rounded-md bg-surface border border-line-soft transition hover:bg-blue-100/40 active:translate-y-px',
        e.borde,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar nombre={nombreCompleto(adulto)} src={adulto.foto} size={44} />
        <div className="flex flex-col flex-1 min-w-0 pt-0.5">
          <strong className="text-base font-bold text-ink truncate">{nombreCorto(adulto)}</strong>
          <span className="text-sm text-muted truncate">{alerta.titulo}</span>
        </div>
        <time className="flex-none text-xs font-medium text-muted" dateTime={alerta.creadaEn}>
          {haceTiempo(alerta.creadaEn)}
        </time>
      </div>
      <p className="text-base leading-normal text-ink-2 line-clamp-3">{alerta.descripcion}</p>
      <div className="flex flex-wrap gap-2">
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-bold tracking-[0.04em] uppercase', e.sev)}>
          <span className="sr-only">Urgencia </span>
          {e.label}
        </span>
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-bold tracking-[0.04em] uppercase', e.cat)}>
          {alerta.categoria}
        </span>
      </div>
    </Link>
  )
}
