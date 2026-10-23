/*
 * RiesgosSeccion.tsx — Riesgo del adulto mayor: nivel vigente (Envejeciente.riesgo, el más alto de los
 * factores vigentes) e HISTORIAL de la tabla Env_Riesgo (factor del catálogo Riesgo, Nivel_Riesgo,
 * Riesgo_Estado vigente/superado, Riesgo_Motivo, Riesgo_Observacion, Riesgo_Fecha y quién lo registró).
 * Con permiso adultos:evaluar: registrar un factor (registrarRiesgo), marcarlo superado o volver a ponerlo
 * vigente (cambiarEstadoRiesgo) y abrir la evaluación de riesgo (cuestionario).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { CircleCheck, History, Plus, RotateCcw, ShieldCheck } from 'lucide-react'
import { Badge, Button, ButtonLink, RiesgoBadge, SelectField, Sheet, TextareaField, TextField, useToast } from '@/components/ui'
import { cambiarEstadoRiesgo, registrarRiesgo, type DatosRiesgo } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { riesgosDe } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, EnvRiesgo } from '@/domain/types'
import { cn } from '@/lib/cn'
import { nombreCatalogo, nombreUsuario } from '../../lib/datos'
import { ESTADO_RIESGO_TEXTO, TONO_RIESGO_ESTADO } from '../../lib/formato'
import { NotaInfo, Seccion } from '../Piezas'
import { RiesgoSelector } from '../RiesgoSelector'

const VACIO: DatosRiesgo = { riesgoId: '', nivel: '', motivo: '', observacion: '' }
const LIMITE = 4
type Errores = Partial<Record<keyof DatosRiesgo, string | undefined>>

export function RiesgosSeccion({ adulto, base, puedeEvaluar, className }: { adulto: Adulto; base: string; puedeEvaluar: boolean; className?: string }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const todos = useDB((s) => s.riesgos)
  const factores = useDB((s) => s.catalogos.riesgos)
  const usuarios = useDB((s) => s.usuarios)
  const historial = useMemo(() => {
    const lista = riesgosDe(todos, adulto.id)
    return [...lista.filter((r) => r.estado === 'vigente'), ...lista.filter((r) => r.estado !== 'vigente')]
  }, [todos, adulto.id])
  const vigentes = historial.filter((r) => r.estado === 'vigente').length

  const [verTodo, setVerTodo] = useState(false)
  const [nuevo, setNuevo] = useState<DatosRiesgo | null>(null)
  const [errores, setErrores] = useState<Errores>({})
  const [cambio, setCambio] = useState<{ registro: EnvRiesgo; observacion: string } | null>(null)
  const cerrarNuevo = useCallback(() => {
    setNuevo(null)
    setErrores({})
  }, [])
  const cerrarCambio = useCallback(() => setCambio(null), [])

  // El factor «Evaluación de riesgo» solo se registra con el cuestionario.
  const opciones = factores.filter((f) => f.id !== 'r-evaluacion').map((f) => ({ value: f.id, label: f.nombre }))
  const descripcionFactor = factores.find((f) => f.id === nuevo?.riesgoId)?.descripcion

  const set = <K extends keyof DatosRiesgo>(k: K, v: DatosRiesgo[K]) => {
    setNuevo((d) => (d ? { ...d, [k]: v } : d))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!nuevo) return
    const anterior = adulto.riesgo
    const r = registrarRiesgo(user, adulto.id, nuevo)
    if (!r.ok) {
      setErrores((r.errores ?? {}) as Errores)
      toast(r.error, 'error')
      return
    }
    toast(r.valor.nivel !== anterior && r.valor.nivel === 'alto' ? 'Factor registrado: el nivel del adulto pasó a Alto' : 'Factor de riesgo registrado')
    cerrarNuevo()
  }

  const confirmarCambio = () => {
    if (!cambio) return
    const destino = cambio.registro.estado === 'vigente' ? 'superado' : 'vigente'
    const r = cambiarEstadoRiesgo(user, cambio.registro.id, destino, cambio.observacion)
    if (!r.ok) return toast(r.error, 'error')
    setCambio(null)
    toast(destino === 'superado' ? 'Factor marcado como superado' : 'Factor vigente de nuevo')
  }

  const visibles = verTodo ? historial : historial.slice(0, LIMITE)

  return (
    <Seccion
      titulo="Riesgo"
      id="riesgo"
      className={className}
      accion={
        puedeEvaluar && (
          <Button size="sm" variant="light" icon={<Plus size={18} aria-hidden />} onClick={() => setNuevo({ ...VACIO })} disabled={!enLinea}>
            Registrar factor
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col items-start gap-1">
            <span className="text-sm font-semibold text-ink">Nivel vigente</span>
            <RiesgoBadge riesgo={adulto.riesgo} />
          </div>
          {puedeEvaluar && (
            <ButtonLink size="sm" variant="outline" to={`${base}/adultos/${adulto.id}/riesgo`} state={{ desde: 'perfil' }} icon={<ShieldCheck size={18} aria-hidden />}>
              {adulto.evaluacion ? 'Reevaluar' : 'Evaluación de riesgo'}
            </ButtonLink>
          )}
        </div>
        <p className="text-xs text-muted">
          {adulto.evaluacion
            ? `Última evaluación: ${adulto.evaluacion.puntaje} de 100 puntos · ${fechaCorta(adulto.evaluacion.fecha)} · por ${nombreUsuario(usuarios, adulto.evaluacion.evaluadoPor) ?? '—'}. `
            : 'Sin evaluación de riesgo (cuestionario). '}
          El nivel del perfil es el más alto entre los factores vigentes ({vigentes}).
        </p>

        <h3 className="flex items-center gap-2 pt-2 text-base font-bold text-navy border-t border-line-soft">
          <History size={18} aria-hidden /> Historial de factores ({historial.length})
        </h3>
        {historial.length === 0 ? (
          <p className="text-sm text-muted">Sin registros de riesgo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibles.map((r) => (
              <li key={r.id} className={cn('flex flex-col gap-1.5 p-3 rounded-sm border', r.estado === 'vigente' ? 'border-line bg-bg' : 'border-line-soft bg-surface-2/50')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <strong className={cn('text-sm', r.estado === 'vigente' ? 'text-ink' : 'text-ink-2')}>{nombreCatalogo(factores, r.riesgoId)}</strong>
                  <span className="flex flex-wrap items-center gap-1">
                    <RiesgoBadge riesgo={r.nivel} />
                    <Badge tone={TONO_RIESGO_ESTADO[r.estado]}>{ESTADO_RIESGO_TEXTO[r.estado]}</Badge>
                  </span>
                </div>
                <p className="text-sm text-ink-2">{r.motivo}</p>
                {r.observacion && <p className="text-sm text-muted italic">Observación: {r.observacion}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {fechaHora(r.fecha)} · {nombreUsuario(usuarios, r.registradoPor) ?? 'Usuario no disponible'}
                  </span>
                  {puedeEvaluar && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={r.estado === 'vigente' ? <CircleCheck size={18} aria-hidden /> : <RotateCcw size={18} aria-hidden />}
                      onClick={() => setCambio({ registro: r, observacion: '' })}
                      disabled={!enLinea}
                    >
                      {r.estado === 'vigente' ? 'Marcar superado' : 'Reactivar'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {historial.length > LIMITE && (
          <Button size="sm" variant="outline" onClick={() => setVerTodo((x) => !x)}>
            {verTodo ? 'Ver menos' : `Ver todo el historial (${historial.length})`}
          </Button>
        )}
      </div>

      <Sheet open={!!nuevo} onClose={cerrarNuevo} title="Registrar factor de riesgo">
        {nuevo && (
          <form className="flex flex-col gap-3" onSubmit={guardar} noValidate>
            <SelectField
              label="Factor de riesgo"
              required
              placeholder="Seleccionar"
              value={nuevo.riesgoId}
              onChange={(e) => set('riesgoId', e.target.value)}
              options={opciones}
              error={errores.riesgoId}
              hint={descripcionFactor}
              help="Situación identificada que aumenta la vulnerabilidad del adulto mayor. Para recalcular el nivel general usa la Evaluación de riesgo."
            />
            <RiesgoSelector label="Nivel" value={nuevo.nivel} onChange={(n) => set('nivel', n)} error={errores.nivel} />
            <TextField
              label="Motivo"
              required
              autoComplete="off"
              maxLength={200}
              placeholder="Ej.: Se cayó dos veces este mes"
              value={nuevo.motivo}
              onChange={(e) => set('motivo', e.target.value)}
              error={errores.motivo}
            />
            <TextareaField
              label="Observación"
              maxLength={300}
              rows={3}
              value={nuevo.observacion}
              onChange={(e) => set('observacion', e.target.value)}
              error={errores.observacion}
              hint={`Opcional · ${nuevo.observacion.length}/300`}
            />
            {nuevo.nivel === 'alto' && adulto.riesgo !== 'alto' && (
              <NotaInfo tono="aviso">Con un factor de nivel Alto el perfil pasa a riesgo Alto y el sistema genera una alerta de caso prioritario.</NotaInfo>
            )}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" onClick={cerrarNuevo}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!enLinea}>
                Registrar
              </Button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet
        open={!!cambio}
        onClose={cerrarCambio}
        title={cambio?.registro.estado === 'vigente' ? 'Marcar factor como superado' : 'Volver a poner vigente'}
        footer={
          <>
            <Button variant="outline" onClick={cerrarCambio}>
              Cancelar
            </Button>
            <Button onClick={confirmarCambio} disabled={!enLinea}>
              Confirmar
            </Button>
          </>
        }
      >
        {cambio && (
          <>
            <p>
              <b>{nombreCatalogo(factores, cambio.registro.riesgoId)}</b> · {cambio.registro.motivo}
            </p>
            <p className="text-sm text-ink-2">
              {cambio.registro.estado === 'vigente'
                ? 'El factor quedará en el historial como superado y el nivel del perfil se recalculará con los factores que sigan vigentes.'
                : 'El factor volverá a contar para el nivel de riesgo del perfil.'}
            </p>
            <TextareaField
              label="Observación"
              maxLength={300}
              rows={3}
              placeholder="Ej.: Ya cuenta con andador y barandas en el baño."
              value={cambio.observacion}
              onChange={(e) => setCambio((c) => (c ? { ...c, observacion: e.target.value } : c))}
              hint="Opcional · reemplaza la observación anterior"
            />
          </>
        )}
      </Sheet>
    </Seccion>
  )
}
