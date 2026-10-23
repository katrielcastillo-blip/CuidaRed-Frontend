/*
 * reglas.ts — Motor de alertas automáticas.
 * Módulo: dominio · alertas (RF-04 / CU-09 y RF-05 / CU-10).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *  RF-04 Caso prioritario: alerta de urgencia "Alta" si el adulto tiene riesgo "Alto" O al menos una
 *        necesidad "Pendiente" de categoría "Medicamentos". Si se cumplen ambas, UNA sola alerta.
 *  RF-05 Seguimiento familiar: alerta en estado "Pendiente" si pasan más de N (15) días calendario desde
 *        la última visita completada o, si nunca hubo visitas, desde la creación del perfil.
 *
 * aplicarReglas() es idempotente: se ejecuta tras cada cambio en el servidor y periódicamente
 * (evaluación continua). Mantiene una única alerta abierta por adulto y tipo; la actualiza si cambian las
 * condiciones, la cierra sola cuando dejan de cumplirse y no la regenera si ya fue atendida por la misma
 * causa (campo `firma`).
 */
import { auditar } from './auditoria'
import { diasCalendario, fechaCorta } from './dates'
import { configOrg, visitaIncluye } from './relaciones'
import type { Adulto, Alerta, DB, Visita } from './types'

export const DIAS_SIN_VISITA_POR_DEFECTO = 15

let secuencia = 0
const nuevoId = () => `al-${Date.now().toString(36)}${(secuencia++).toString(36)}`

/** Instante en que terminó la visita completada más reciente del adulto (o undefined). */
export function ultimaVisitaCompletada(visitas: Visita[], adultoId: string): Visita | undefined {
  let ult: Visita | undefined
  const clave = (v: Visita) => v.fin ?? `${v.fecha}T${v.horaPautada}`
  for (const v of visitas) {
    if (!visitaIncluye(v, adultoId) || v.estado !== 'completada') continue
    if (!ult || clave(v) > clave(ult)) ult = v
  }
  return ult
}

/** Días calendario desde la última visita (o desde la creación del perfil si no tiene visitas). */
export function diasSinVisita(db: Pick<DB, 'visitas'>, adulto: Adulto, ahora = new Date()) {
  const ult = ultimaVisitaCompletada(db.visitas, adulto.id)
  return { dias: diasCalendario(ult ? (ult.fin ?? ult.fecha) : adulto.creadoEn, ahora), referencia: ult ? (ult.fin ?? ult.fecha) : adulto.creadoEn, conVisitas: !!ult }
}

/** Condiciones de caso prioritario (RF-04) que cumple hoy el adulto. */
export function condicionesPrioritarias(db: Pick<DB, 'necesidades'>, adulto: Adulto): { textos: string[]; firma: string } {
  const textos: string[] = []
  const partes: string[] = []
  if (adulto.riesgo === 'alto') {
    textos.push('Nivel de riesgo social "Alto"')
    partes.push(`riesgo:${adulto.evaluacion?.fecha ?? 'asignado'}`)
  }
  const meds = db.necesidades.filter((n) => n.adultoId === adulto.id && n.tipo === 'medicamentos' && n.estado === 'pendiente')
  if (meds.length > 0) {
    textos.push(meds.length === 1 ? 'Necesidad de medicamentos pendiente' : `${meds.length} necesidades de medicamentos pendientes`)
    partes.push(...meds.map((n) => `med:${n.id}`).sort())
  }
  return { textos, firma: partes.join('|') }
}

const ultimaDeTipo = (alertas: Alerta[], adultoId: string, tipo: Alerta['tipo']) =>
  alertas.filter((a) => a.adultoId === adultoId && a.tipo === tipo).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0]

const TEXTO_TIPO: Record<Alerta['tipo'], string> = { prioritaria: 'Caso prioritario', seguimiento: 'Seguimiento familiar', emergencia: 'Emergencia', necesidad: 'Necesidad' }

/**
 * Notifica una alerta nueva (tabla Notificacion) a los administradores y coordinadores activos de la cuenta,
 * si el parámetro NOTIFICAR_CASOS_PRIORITARIOS está activo.
 */
export function notificarAlerta(db: DB, alerta: Alerta) {
  const adulto = db.adultos.find((a) => a.id === alerta.adultoId)
  if (!adulto || !configOrg(db, adulto.orgId).notificarCasosPrioritarios) return
  const destinatarios = db.usuarios.filter((u) => u.orgId === adulto.orgId && u.estado === 'activo' && (u.rol === 'admin' || u.rol === 'coordinador'))
  for (const u of destinatarios) {
    db.notificaciones.push({
      id: nuevoId().replace('al-', 'nt-'),
      usuarioId: u.id,
      fecha: alerta.creadaEn,
      mensaje: `${TEXTO_TIPO[alerta.tipo]}: ${alerta.titulo} · ${adulto.nombre} ${adulto.apellido}`,
      orgId: adulto.orgId,
      estado: 'no_leida',
      alertaId: alerta.id,
    })
  }
}

function cerrarAuto(db: DB, alerta: Alerta, nota: string, ahora: string) {
  alerta.estado = 'atendida'
  alerta.atendidaPor = 'sistema'
  alerta.atendidaEn = ahora
  alerta.actualizadoEn = ahora
  alerta.acciones.push({ id: nuevoId(), fecha: ahora, usuarioId: 'sistema', estado: 'atendida', nota })
  const adulto = db.adultos.find((a) => a.id === alerta.adultoId)
  auditar(db, 'sistema', { accion: 'alerta.cerrar', entidad: 'alerta', registroId: alerta.id, detalle: nota, orgId: adulto?.orgId })
}

/**
 * Una alerta de seguimiento ya atendida por la misma ausencia de visitas no se repite, salvo que vuelva a
 * transcurrir el umbral completo desde que se atendió sin que se registre ninguna visita.
 */
function debeGenerarSeguimiento(ultima: Alerta | undefined, firma: string, umbral: number, fecha: Date) {
  if (!ultima || ultima.firma !== firma) return true
  return diasCalendario(ultima.atendidaEn ?? ultima.actualizadoEn, fecha) > umbral
}

/** Evalúa todas las reglas sobre el borrador `db`. Devuelve true si cambió algo. */
export function aplicarReglas(db: DB, fecha = new Date()): boolean {
  const ahora = fecha.toISOString()
  let cambios = false

  for (const adulto of db.adultos) {
    const abiertas = db.alertas.filter((a) => a.adultoId === adulto.id && a.estado !== 'atendida')

    // Perfiles inactivos o anonimizados no generan alertas; se cierran las automáticas abiertas.
    if (adulto.estado !== 'activo') {
      for (const a of abiertas) {
        if (a.tipo === 'prioritaria' || a.tipo === 'seguimiento') {
          cerrarAuto(db, a, 'Cerrada automáticamente: el perfil fue desactivado.', ahora)
          cambios = true
        }
      }
      continue
    }

    /* ───── RF-04 · Caso prioritario ───── */
    const prio = condicionesPrioritarias(db, adulto)
    const prioAbierta = abiertas.find((a) => a.tipo === 'prioritaria')
    if (prio.textos.length > 0) {
      const descripcion = `Condiciones detectadas: ${prio.textos.join(' y ')}. Requiere atención prioritaria.`
      if (prioAbierta) {
        if (prioAbierta.firma !== prio.firma) {
          prioAbierta.condiciones = prio.textos
          prioAbierta.descripcion = descripcion
          prioAbierta.firma = prio.firma
          prioAbierta.actualizadoEn = ahora
          auditar(db, 'sistema', { accion: 'alerta.actualizar', entidad: 'alerta', registroId: prioAbierta.id, detalle: prio.textos.join('; '), orgId: adulto.orgId })
          cambios = true
        }
      } else if (ultimaDeTipo(db.alertas, adulto.id, 'prioritaria')?.firma !== prio.firma) {
        const alerta: Alerta = {
          id: nuevoId(),
          adultoId: adulto.id,
          tipo: 'prioritaria',
          severidad: 'alta',
          categoria: 'CASO PRIORITARIO',
          titulo: 'Caso prioritario: requiere atención',
          descripcion,
          condiciones: prio.textos,
          firma: prio.firma,
          creadaEn: ahora,
          estado: 'pendiente',
          generadaPor: 'sistema',
          acciones: [],
          leidaPor: [],
          actualizadoEn: ahora,
        }
        db.alertas.push(alerta)
        notificarAlerta(db, alerta)
        auditar(db, 'sistema', { accion: 'alerta.generar', entidad: 'alerta', registroId: alerta.id, detalle: `Caso prioritario: ${prio.textos.join('; ')}`, orgId: adulto.orgId })
        cambios = true
      }
    } else if (prioAbierta) {
      cerrarAuto(db, prioAbierta, 'Cerrada automáticamente: ya no se cumplen las condiciones de caso prioritario.', ahora)
      cambios = true
    }

    /* ───── RF-05 · Seguimiento familiar ───── */
    const config = configOrg(db, adulto.orgId)
    const umbral = config.diasSinVisitaAlerta || DIAS_SIN_VISITA_POR_DEFECTO
    const { dias, referencia, conVisitas } = diasSinVisita(db, adulto, fecha)
    const segAbierta = abiertas.find((a) => a.tipo === 'seguimiento')
    if (dias > umbral) {
      const titulo = `${dias} días sin visita comunitaria`
      const descripcion = conVisitas
        ? `La última visita registrada fue el ${fechaCorta(referencia)}. Se superó el límite de ${umbral} días calendario: contactar a la familia y programar una visita.`
        : `No hay visitas registradas desde la creación del perfil (${fechaCorta(referencia)}). Se superó el límite de ${umbral} días calendario.`
      const firma = `ref:${referencia}`
      if (segAbierta) {
        if (segAbierta.titulo !== titulo) {
          segAbierta.titulo = titulo
          segAbierta.descripcion = descripcion
          segAbierta.condiciones = [titulo]
          segAbierta.actualizadoEn = ahora
          cambios = true
        }
      } else if (debeGenerarSeguimiento(ultimaDeTipo(db.alertas, adulto.id, 'seguimiento'), firma, umbral, fecha)) {
        const alerta: Alerta = {
          id: nuevoId(),
          adultoId: adulto.id,
          tipo: 'seguimiento',
          severidad: 'media',
          categoria: 'SEGUIMIENTO FAMILIAR',
          titulo,
          descripcion,
          condiciones: [titulo],
          firma,
          creadaEn: ahora,
          estado: 'pendiente',
          generadaPor: 'sistema',
          acciones: [],
          leidaPor: [],
          actualizadoEn: ahora,
        }
        db.alertas.push(alerta)
        notificarAlerta(db, alerta)
        auditar(db, 'sistema', { accion: 'alerta.generar', entidad: 'alerta', registroId: alerta.id, detalle: `Seguimiento familiar: ${titulo}`, orgId: adulto.orgId })
        cambios = true
      }
    } else if (segAbierta) {
      cerrarAuto(db, segAbierta, conVisitas ? `Cerrada automáticamente: visita registrada el ${fechaCorta(referencia)}.` : 'Cerrada automáticamente: dentro del período permitido.', ahora)
      cambios = true
    }

    /* ───── Necesidades atrasadas (Env_Necesidad.Umbral_alerta) ───── */
    for (const n of db.necesidades) {
      if (n.adultoId !== adulto.id) continue
      const firma = `nec:${n.id}`
      const abierta = abiertas.find((a) => a.tipo === 'necesidad' && a.firma === firma)
      const sinResolver = n.estado === 'pendiente' || n.estado === 'en_proceso'
      const limite = n.umbralAlertaDias ?? config.diasEscalarNecesidad
      const dias = diasCalendario(n.creadaEn, fecha)
      // Las de medicamentos ya generan "caso prioritario" (RF-04): no se duplican.
      if (sinResolver && n.tipo !== 'medicamentos' && dias > limite) {
        if (!abierta && !db.alertas.some((a) => a.firma === firma)) {
          const alerta: Alerta = {
            id: nuevoId(),
            adultoId: adulto.id,
            tipo: 'necesidad',
            severidad: n.prioridad,
            categoria: 'NECESIDAD ATRASADA',
            titulo: `Necesidad sin resolver hace ${dias} días`,
            descripcion: `${n.descripcion} (umbral: ${limite} días).`,
            condiciones: [`Necesidad pendiente por más de ${limite} días`],
            necesidadId: n.id,
            firma,
            creadaEn: ahora,
            estado: 'pendiente',
            generadaPor: 'sistema',
            acciones: [],
            leidaPor: [],
            actualizadoEn: ahora,
          }
          db.alertas.push(alerta)
          notificarAlerta(db, alerta)
          auditar(db, 'sistema', { accion: 'alerta.generar', entidad: 'alerta', registroId: alerta.id, detalle: `Necesidad atrasada ${n.id}`, orgId: adulto.orgId })
          cambios = true
        }
      } else if (abierta && !sinResolver) {
        cerrarAuto(db, abierta, 'Cerrada automáticamente: la necesidad fue resuelta.', ahora)
        cambios = true
      }
    }
  }
  return cambios
}
