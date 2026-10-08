import { useCallback, useId, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Landmark, ShieldPlus, UsersRound } from 'lucide-react'
import { Button, SelectField, Sheet, Switch, useToast } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoNoEncontrado, NotaInfo, RiesgoPill } from '../components/Piezas'
import { guardarEvaluacion } from '../lib/adultos'
import { nombreAdulto } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import {
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
import styles from './RiesgoPage.module.css'

const ICONOS: Record<SeccionRiesgo['id'], typeof Landmark> = { socio: Landmark, salud: ShieldPlus, apoyo: UsersRound }

function FilaSwitch({ texto, valor, onChange }: { texto: string; valor: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className={styles.fila}>
      <label htmlFor={id} className={styles.pregunta}>
        {texto}
      </label>
      <span className={styles.sino} aria-hidden>
        {valor ? 'Sí' : 'No'}
      </span>
      <Switch id={id} checked={valor} onChange={onChange} />
    </div>
  )
}

/** Evaluación de Riesgo (Figma 441:3212 admin · 487:1065 coordinador). */
export default function RiesgoPage() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const adulto = useDB((s) => s.adultos.find((a) => a.id === adultoId && a.orgId === user.orgId))
  if (!adulto) {
    return (
      <Page title="Evaluación de Riesgo" back={`${base}/adultos`} hideAvatar>
        <AdultoNoEncontrado volverA={`${base}/adultos`} />
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
  const perfil = `${base}/adultos/${adulto.id}`
  const { back } = useVolver(perfil)
  const [respuestas, setRespuestas] = useState<Respuestas>(() => respuestasIniciales(adulto))
  const [intentado, setIntentado] = useState(false)
  const [resultado, setResultado] = useState<ResultadoRiesgo | null>(null)

  const faltan = useMemo(
    () => SECCIONES.flatMap((s) => s.preguntas).filter((p) => p.tipo === 'select' && !respuestas[p.clave]),
    [respuestas],
  )
  const set = (clave: string, valor: string | boolean) => setRespuestas((r) => ({ ...r, [clave]: valor }))

  const calcular = () => {
    setIntentado(true)
    if (faltan.length > 0) {
      toast('Completa las preguntas con opciones para calcular el nivel.', 'error')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setResultado(guardarEvaluacion(adulto.id, respuestas, user.id))
  }

  const terminar = useCallback(() => {
    setResultado(null)
    // Si se llegó desde el perfil, se vuelve a él; si venía de «Guardar perfil», se reemplaza esta pantalla por el perfil.
    if ((location.state as { desde?: string } | null)?.desde === 'perfil') navigate(-1)
    else navigate(perfil, { replace: true })
  }, [location.state, navigate, perfil])

  const pintar = (p: Pregunta) => {
    if (p.tipo === 'switch') return <FilaSwitch key={p.clave} texto={p.texto} valor={respuestas[p.clave] === true} onChange={(v) => set(p.clave, v)} />
    return (
      <SelectField
        key={p.clave}
        label={p.texto}
        placeholder="Seleccionar"
        value={String(respuestas[p.clave] ?? '')}
        onChange={(e) => set(p.clave, e.target.value)}
        options={p.opciones.map((o) => ({ value: o.valor, label: o.etiqueta }))}
        error={intentado && !respuestas[p.clave] ? 'Selecciona una opción.' : undefined}
      />
    )
  }

  return (
    <Page title="Evaluación de Riesgo" back={back} hideAvatar>
      <h2 className={styles.nombre}>{nombreAdulto(adulto)}</h2>
      <NotaInfo>Esta evaluación determina automáticamente el nivel de vulnerabilidad del adulto mayor.</NotaInfo>

      <div className={styles.secciones}>
        {SECCIONES.map((s) => {
          const Icono = ICONOS[s.id]
          return (
            <section key={s.id} className={styles.seccion} aria-labelledby={`sec-${s.id}`}>
              <h3 id={`sec-${s.id}`} className={styles.seccionTitulo}>
                <Icono size={22} aria-hidden />
                {s.titulo}
              </h3>
              <div className={styles.preguntas}>{s.preguntas.map(pintar)}</div>
            </section>
          )
        })}
      </div>

      <div className={styles.pie}>
        <Button fullWidth onClick={calcular}>
          Calcular nivel de riesgo
        </Button>
        <p className={styles.nota}>El resultado se calculará automáticamente según las respuestas.</p>
      </div>

      <Sheet
        open={!!resultado}
        onClose={terminar}
        title="Resultado de la evaluación"
        footer={<Button onClick={terminar}>Ver perfil</Button>}
      >
        {resultado && (
          <>
            <div className={styles.resultado}>
              <RiesgoPill riesgo={resultado.nivel} />
              <p className={styles.puntaje}>
                {resultado.puntaje}
                <small> / {PUNTAJE_MAX} puntos</small>
              </p>
              <p className={styles.mensaje}>{MENSAJE_NIVEL[resultado.nivel]}</p>
            </div>
            <ul className={styles.desglose} aria-label="Desglose del puntaje">
              {resultado.desglose.map((d) => (
                <li key={d.id}>
                  <div className={styles.desgloseTop}>
                    <span>{d.titulo}</span>
                    <strong>
                      {d.puntos} / {d.max}
                    </strong>
                  </div>
                  <div className={styles.barra} aria-hidden>
                    <span style={{ width: `${(d.puntos / d.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className={styles.criterio}>
              Bajo: 0–{UMBRAL_MEDIO - 1} · Medio: {UMBRAL_MEDIO}–{UMBRAL_ALTO - 1} · Alto: {UMBRAL_ALTO}–{PUNTAJE_MAX}
            </p>
            {resultado.nivel === 'alto' && (
              <p className={styles.criterio}>
                Se registró una alerta «RIESGO ALTO». Revísala en <Link to={`${base}/alertas`}>Alertas</Link>.
              </p>
            )}
          </>
        )}
      </Sheet>
    </Page>
  )
}
