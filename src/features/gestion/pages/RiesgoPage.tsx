/*
 * RiesgoPage.tsx — Evaluación de riesgo social del adulto mayor: puntaje ponderado → nivel (RF-01).
 * Guarda con la capa de servicios (guardarEvaluacionRiesgo); si el nivel queda en "Alto", el motor de
 * reglas (domain/reglas.ts) genera la alerta de caso prioritario (RF-04 · CU-09). Explica el resultado y muestra
 * el registro que quedó en el historial de riesgos (Env_Riesgo, factor "Evaluación de riesgo") y los factores
 * vigentes que determinan el nivel del perfil.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useId, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Landmark, ShieldPlus, UsersRound } from 'lucide-react'
import { Badge, Button, RiesgoBadge, SelectField, Sheet, Switch, useToast } from '@/components/ui'
import { guardarEvaluacionRiesgo } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { alcanzaAdulto } from '@/domain/permisos'
import { riesgosDe, voluntariosDe } from '@/domain/relaciones'
import { fechaHora } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { NoEncontrado, NotaInfo } from '../components/Piezas'
import { nombreCatalogo, nombreUsuario } from '../lib/datos'
import { ESTADO_RIESGO_TEXTO, nombreAdulto, RIESGO_TEXTO, TONO_RIESGO_ESTADO } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import {
  calcularRiesgo,
  MENSAJE_NIVEL,
  PUNTAJE_MAX,
  respuestasIniciales,
  SECCIONES,
  UMBRAL_ALTO,
  UMBRAL_MEDIO,
  type Pregunta,
  type Respuestas,
  type ResultadoRiesgo,
  type SeccionRiesgo,
} from '../lib/riesgo'

const ICONOS: Record<SeccionRiesgo['id'], typeof Landmark> = { socio: Landmark, salud: ShieldPlus, apoyo: UsersRound }

function FilaSwitch({ texto, valor, onChange }: { texto: string; valor: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 min-h-12">
      <label htmlFor={id} className="flex-1 text-base text-ink">
        {texto}
      </label>
      <span className="w-6 text-sm font-semibold text-ink-2" aria-hidden>
        {valor ? 'Sí' : 'No'}
      </span>
      <Switch id={id} checked={valor} onChange={onChange} />
    </div>
  )
}

export default function RiesgoPage() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const adulto = useMemo(() => adultos.find((a) => a.id === adultoId && alcanzaAdulto(user, a)), [adultos, adultoId, user])
  if (!adulto) {
    return (
      <Page title="Evaluación de riesgo" back={`${base}/adultos`} hideAvatar>
        <NoEncontrado volverA={`${base}/adultos`} que="este perfil" />
      </Page>
    )
  }
  return <Evaluacion key={adulto.id} adulto={adulto} />
}

function Evaluacion({ adulto }: { adulto: Adulto }) {
  const { base } = useShell()
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const location = useLocation()
  const enLinea = useEnLinea()
  const alertas = useDB((s) => s.alertas)
  const riesgos = useDB((s) => s.riesgos)
  const vinculos = useDB((s) => s.vinculos)
  const usuarios = useDB((s) => s.usuarios)
  const factores = useDB((s) => s.catalogos.riesgos)
  const perfil = `${base}/adultos/${adulto.id}`
  const { back } = useVolver(perfil)
  const [respuestas, setRespuestas] = useState<Respuestas>(() => respuestasIniciales(adulto, voluntariosDe(vinculos, adulto.id).length > 0))
  const [intentado, setIntentado] = useState(false)
  const [resultado, setResultado] = useState<(ResultadoRiesgo & { anterior: Adulto['riesgo']; fecha: string }) | null>(null)
  // Registro de Env_Riesgo creado por esta evaluación y factores vigentes tras guardarla.
  const historial = useMemo(() => riesgosDe(riesgos, adulto.id), [riesgos, adulto.id])
  const registro = resultado ? historial.find((r) => r.riesgoId === 'r-evaluacion' && r.fecha === resultado.fecha) : undefined
  const vigentes = historial.filter((r) => r.estado === 'vigente')

  const faltan = useMemo(() => SECCIONES.flatMap((s) => s.preguntas).filter((p) => p.tipo === 'select' && !respuestas[p.clave]), [respuestas])
  const previo = useMemo(() => calcularRiesgo(respuestas), [respuestas])
  const set = (clave: string, valor: string | boolean) => setRespuestas((r) => ({ ...r, [clave]: valor }))

  // Alerta de caso prioritario abierta para el adulto (la crea el motor de reglas, no esta pantalla).
  const alertaPrioritaria = alertas.find((a) => a.adultoId === adulto.id && a.tipo === 'prioritaria' && a.estado !== 'atendida')

  const calcular = () => {
    setIntentado(true)
    if (faltan.length > 0) {
      toast('Responde las preguntas marcadas para calcular el nivel.', 'error')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    const calc = calcularRiesgo(respuestas)
    const r = guardarEvaluacionRiesgo(user, adulto.id, { respuestas, puntaje: calc.puntaje, nivel: calc.nivel })
    if (!r.ok) {
      toast(r.error, 'error')
      return
    }
    setResultado({ ...calc, anterior: adulto.riesgo, fecha: r.valor.fecha })
  }

  const terminar = useCallback(() => {
    setResultado(null)
    if ((location.state as { desde?: string } | null)?.desde === 'perfil') navigate(-1)
    else navigate(perfil, { replace: true })
  }, [location.state, navigate, perfil])

  const pintar = (p: Pregunta) => {
    if (p.tipo === 'switch') return <FilaSwitch key={p.clave} texto={p.texto} valor={respuestas[p.clave] === true} onChange={(v) => set(p.clave, v)} />
    return (
      <SelectField
        key={p.clave}
        label={p.texto}
        required
        placeholder="Seleccionar"
        value={String(respuestas[p.clave] ?? '')}
        onChange={(e) => set(p.clave, e.target.value)}
        options={p.opciones.map((o) => ({ value: o.valor, label: o.etiqueta }))}
        error={intentado && !respuestas[p.clave] ? 'Selecciona una opción.' : undefined}
      />
    )
  }

  return (
    <Page title="Evaluación de riesgo" back={back} hideAvatar>
      <div className="flex flex-col gap-5 w-full max-w-form mx-auto">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-navy">{nombreAdulto(adulto)}</h2>
          <p className="flex items-center gap-2 text-sm text-ink-2">
            Nivel actual: <RiesgoBadge riesgo={adulto.riesgo} />
          </p>
        </div>
        <NotaInfo>
          Responde según la situación actual. Cada respuesta suma puntos (0 a {PUNTAJE_MAX}): a mayor puntaje, mayor vulnerabilidad. Bajo: 0–{UMBRAL_MEDIO - 1} · Medio: {UMBRAL_MEDIO}–
          {UMBRAL_ALTO - 1} · Alto: {UMBRAL_ALTO}–{PUNTAJE_MAX}. Si el resultado es <b>Alto</b>, el sistema genera automáticamente una alerta de caso prioritario.
        </NotaInfo>

        {SECCIONES.map((s) => {
          const Icono = ICONOS[s.id]
          return (
            <section key={s.id} className="flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1" aria-labelledby={`sec-${s.id}`}>
              <h3 id={`sec-${s.id}`} className="flex items-center gap-2 text-lg font-bold text-navy">
                <Icono size={22} aria-hidden />
                {s.titulo}
              </h3>
              <div className="flex flex-col gap-3">{s.preguntas.map(pintar)}</div>
            </section>
          )
        })}

        <div className="sticky bottom-[calc(var(--bottomnav-h)+var(--safe-bottom)+8px)] md:bottom-4 flex flex-col gap-2 p-3 rounded-md bg-surface shadow-2">
          <p className="flex items-center justify-between gap-3 text-sm text-ink-2" aria-live="polite">
            <span>
              Puntaje previsto: <b className="text-ink">{previo.puntaje}</b> / {PUNTAJE_MAX}
            </span>
            {faltan.length === 0 ? <RiesgoBadge riesgo={previo.nivel} /> : <span className="text-xs">Faltan {faltan.length} respuesta(s)</span>}
          </p>
          <Button fullWidth onClick={calcular} disabled={!enLinea}>
            Guardar evaluación
          </Button>
          {!enLinea && <p className="text-sm text-warning-700 font-semibold">Sin conexión: la evaluación necesita internet para guardarse.</p>}
        </div>
      </div>

      <Sheet open={!!resultado} onClose={terminar} title="Resultado de la evaluación" footer={<Button onClick={terminar}>Ver perfil</Button>}>
        {resultado && (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <RiesgoBadge riesgo={resultado.nivel} />
              <p className="text-4xl font-bold text-ink">
                {resultado.puntaje}
                <small className="text-base font-normal text-muted"> / {PUNTAJE_MAX} puntos</small>
              </p>
              <p className="text-ink-2">{MENSAJE_NIVEL[resultado.nivel]}</p>
              <p className="text-sm text-muted">
                {resultado.anterior === adulto.riesgo
                  ? `El nivel del perfil se mantiene en ${RIESGO_TEXTO[adulto.riesgo]}.`
                  : `El nivel del perfil cambió de ${RIESGO_TEXTO[resultado.anterior]} a ${RIESGO_TEXTO[adulto.riesgo]}.`}
              </p>
            </div>
            {registro && (
              <section className="flex flex-col gap-1.5 p-3 rounded-sm border border-blue bg-blue-100" aria-labelledby="registro-riesgo">
                <h3 id="registro-riesgo" className="text-sm font-bold text-navy">
                  Registrado en el historial de riesgos
                </h3>
                <div className="flex flex-wrap items-center gap-1">
                  <strong className="text-sm text-ink">{nombreCatalogo(factores, registro.riesgoId)}</strong>
                  <RiesgoBadge riesgo={registro.nivel} />
                  <Badge tone={TONO_RIESGO_ESTADO[registro.estado]}>{ESTADO_RIESGO_TEXTO[registro.estado]}</Badge>
                </div>
                <p className="text-sm text-ink-2">{registro.motivo}</p>
                <p className="text-xs text-muted">
                  {fechaHora(registro.fecha)} · {nombreUsuario(usuarios, registro.registradoPor) ?? '—'}. La clasificación general anterior quedó como «Superado».
                </p>
                {vigentes.length > 1 && (
                  <p className="text-xs text-ink-2">
                    Factores vigentes que definen el nivel del perfil (se toma el más alto):{' '}
                    {vigentes.map((v) => `${nombreCatalogo(factores, v.riesgoId)} (${RIESGO_TEXTO[v.nivel]})`).join(', ')}.
                  </p>
                )}
              </section>
            )}
            <ul className="flex flex-col gap-3" aria-label="Desglose del puntaje">
              {resultado.desglose.map((d) => (
                <li key={d.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span>{d.titulo}</span>
                    <strong>
                      {d.puntos} / {d.max}
                    </strong>
                  </div>
                  <div className="h-2 rounded-pill bg-surface-2 overflow-hidden" aria-hidden>
                    <span className={cn('block h-full rounded-pill', d.puntos / d.max >= 0.55 ? 'bg-riesgo-alto' : d.puntos / d.max >= 0.3 ? 'bg-riesgo-medio' : 'bg-riesgo-bajo')} style={{ width: `${(d.puntos / d.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {adulto.riesgo === 'alto' && (
              <NotaInfo tono="aviso">
                Caso prioritario (RF-04): el sistema registró una alerta de urgencia Alta para el equipo de coordinación.{' '}
                {alertaPrioritaria ? (
                  <Link to={`${base}/alertas/${alertaPrioritaria.id}`} className="font-semibold text-navy underline">
                    Ver la alerta
                  </Link>
                ) : (
                  <Link to={`${base}/alertas`} className="font-semibold text-navy underline">
                    Ver alertas
                  </Link>
                )}
              </NotaInfo>
            )}
          </>
        )}
      </Sheet>
    </Page>
  )
}
