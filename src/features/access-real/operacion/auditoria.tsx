/* Consulta del registro de auditoría de la cuenta · RF-21. © 2026 Equipo CuidaRed – INTEC. */
import { useState } from 'react'
import { Card, SelectField } from '@/components/ui'
import { fechaHora } from '@/domain/dates'
import { Estado, Paginador, usePagina } from './controles'
import type { OperacionProps } from './visitas'

interface Evento {
  auditoria_id: string
  actor: string | null
  accion: 'alta' | 'actualizacion' | 'baja'
  entidad: string
  fecha: string
  resultado: 'confirmado'
}

const ACCIONES = { alta: 'Alta', actualizacion: 'Actualización', baja: 'Baja' }
const ENTIDADES: Record<string, string> = {
  cuenta: 'Cuenta', configuracion_cuenta: 'Configuración', membresia: 'Membresía',
  envejeciente: 'Expediente', contacto_emergencia: 'Contacto de emergencia', vinculo: 'Asignación o permiso familiar',
  indicacion_medica: 'Indicación médica', envejeciente_riesgo: 'Factor de riesgo', evaluacion_riesgo: 'Evaluación de riesgo',
  visita: 'Visita', detalle_visita: 'Detalle de visita', registro_visita: 'Participación en visita',
  tarea_agenda: 'Tarea', evidencia: 'Evidencia de tarea', evidencia_visita: 'Evidencia de visita',
  evidencia_indicacion: 'Adjunto de indicación', solicitud_visita: 'Solicitud de visita',
}

export function AuditoriaCuenta({ base, token }: OperacionProps) {
  const [orden, setOrden] = useState('-fecha')
  const consulta = usePagina<Evento>(`${base}/auditoria`, token, 0, { sort: [orden] })
  return <section className="grid gap-3" aria-label="Actividad de la cuenta">
    <div className="max-w-sm">
      <SelectField label="Orden de la actividad" value={orden} onChange={(event) => setOrden(event.currentTarget.value)}
        options={[{ value: '-fecha', label: 'Más reciente primero' }, { value: 'fecha', label: 'Más antigua primero' }]} />
    </div>
    <Estado consulta={consulta} vacio={consulta.datos?.data.length === 0 ? 'Sin actividad registrada.' : undefined} />
    {consulta.datos?.data.map((evento) => <Card key={evento.auditoria_id} className="grid gap-1">
      <h2 className="font-semibold">{ACCIONES[evento.accion]} · {ENTIDADES[evento.entidad] ?? 'Registro de la cuenta'}</h2>
      <p className="text-sm text-ink-2">{evento.actor ?? 'Sin actor registrado'} · {fechaHora(evento.fecha)}</p>
      <p className="text-sm">Resultado confirmado</p>
    </Card>)}
    {consulta.datos && <Paginador pagina={consulta.pagina} total={consulta.datos.meta.totalPages} cambiar={consulta.cambiar} />}
  </section>
}
