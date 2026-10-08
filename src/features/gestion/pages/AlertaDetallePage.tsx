import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarClock, Clock, MessageSquareText, Tag, UserRound, UsersRound } from 'lucide-react'
import { Button, ButtonLink, IconTile, Switch, TextareaField, useToast } from '@/components/ui'
import { nombreCompleto, useUser } from '@/domain/auth'
import { fechaCorta, hora12, relativo } from '@/domain/dates'
import { getDB, useDB } from '@/domain/store'
import type { Adulto, Alerta } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { CategoriaPill, SeveridadPill } from '../components/Piezas'
import { actualizarAlerta } from '../lib/adultos'
import { reportadoPor } from '../lib/datos'
import { ESTADO_ALERTA_TEXTO, nombreAdulto } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import styles from './AlertaDetallePage.module.css'

const cuando = (iso: string) => {
  const r = relativo(iso)
  return /^(Hoy|Ayer)/.test(r) ? `${r} (${fechaCorta(iso)})` : `${fechaCorta(iso)}, ${hora12(iso)}`
}

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()

/** Detalle Alerta (Figma 479:1412 admin · 487:1804 / 499:3182 coordinador). */
export default function AlertaDetallePage() {
  const { alertaId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/alertas`)
  const alerta = useDB((s) => s.alertas.find((a) => a.id === alertaId))
  const adulto = useDB((s) => s.adultos.find((a) => a.id === alerta?.adultoId && a.orgId === user.orgId))

  if (!alerta || !adulto) {
    return (
      <Page title="Detalle Alerta" back={`${base}/alertas`} hideAvatar>
        <div className={styles.vacio}>
          <p className={styles.vacioTitulo}>No encontramos esta alerta</p>
          <ButtonLink to={`${base}/alertas`}>Volver a Alertas</ButtonLink>
        </div>
      </Page>
    )
  }
  return <Detalle key={alerta.id} alerta={alerta} adulto={adulto} back={back} />
}

function Detalle({ alerta, adulto, back }: { alerta: Alerta; adulto: Adulto; back: boolean | string }) {
  const { base } = useShell()
  const user = useUser()
  const toast = useToast()
  const idSwitch = useId()
  const usuarios = useDB((s) => s.usuarios)
  const [atendida, setAtendida] = useState(alerta.estado === 'atendida')
  const [nota, setNota] = useState(alerta.notaAtencion ?? '')
  const [error, setError] = useState<string>()

  const reporta = reportadoPor(getDB(), alerta, adulto)
  const quienAtendio = usuarios.find((u) => u.id === alerta.atendidaPor)
  const esCoordinador = user.rol === 'coordinador'

  // La nota es obligatoria al cerrar la alerta (al pasar a «atendida»); si ya lo estaba no se exige de nuevo.
  const cierraAhora = atendida && alerta.estado !== 'atendida'

  const guardar = () => {
    if (cierraAhora && nota.trim().length < 3) {
      setError('Escribe una nota de atención para marcar la alerta como atendida.')
      return
    }
    setError(undefined)
    const estado: Alerta['estado'] = atendida ? 'atendida' : alerta.estado === 'atendida' ? 'pendiente' : alerta.estado
    actualizarAlerta(alerta.id, {
      estado,
      atendidaPor: atendida ? (alerta.estado === 'atendida' ? (alerta.atendidaPor ?? user.id) : user.id) : undefined,
      notaAtencion: nota,
    })
    toast(atendida ? 'Alerta marcada como atendida' : alerta.estado === 'atendida' ? 'Alerta reabierta' : 'Cambios guardados')
  }

  const ponerEnAtencion = () => {
    setError(undefined)
    actualizarAlerta(alerta.id, { estado: 'en_atencion', notaAtencion: nota })
    toast('La alerta quedó en atención')
  }

  const estadoClase = { pendiente: styles.espera, en_atencion: styles.enAtencion, atendida: styles.ok }[alerta.estado]
  const estadoTexto = alerta.estado === 'pendiente' ? 'En espera' : ESTADO_ALERTA_TEXTO[alerta.estado]

  return (
    <Page title="Detalle Alerta" back={back} hideAvatar>
      <div className={styles.layout}>
        <header className={styles.quien}>
          <IconTile size={63}>
            <UserRound size={32} aria-hidden />
          </IconTile>
          <div className={styles.quienTexto}>
            <h2>{nombreAdulto(adulto)}</h2>
            <div className={styles.etiquetas}>
              <SeveridadPill severidad={alerta.severidad} />
              <CategoriaPill>{alerta.categoria}</CategoriaPill>
            </div>
            <Link to={`${base}/adultos/${adulto.id}`} className={styles.perfil}>
              Ver perfil completo →
            </Link>
          </div>
        </header>

        <section className={styles.tarjeta} aria-labelledby="info-alerta">
          <h3 id="info-alerta" className={styles.titulo}>
            Información de la Alerta
          </h3>
          <dl className={styles.filas}>
            <div className={styles.fila}>
              <dt>
                <Clock size={16} aria-hidden /> Fecha y hora
              </dt>
              <dd>{cuando(alerta.creadaEn)}</dd>
            </div>
            <div className={styles.fila}>
              <dt>
                <Tag size={16} aria-hidden /> Categoría
              </dt>
              <dd>
                <span className={styles.chipValor}>{capitalizar(alerta.categoria)}</span>
              </dd>
            </div>
            <div className={styles.fila}>
              <dt>
                <UsersRound size={16} aria-hidden /> Reportado por
              </dt>
              <dd>{reporta}</dd>
            </div>
          </dl>
          <h3 className={styles.subtitulo}>Descripción</h3>
          <div className={styles.caja}>
            <strong className={styles.asunto}>{alerta.titulo}</strong>
            <p>{alerta.descripcion}</p>
          </div>
        </section>

        <section className={styles.tarjeta} aria-labelledby="estado-alerta">
          <div className={styles.estadoTop}>
            <h3 id="estado-alerta" className={styles.titulo}>
              Estado de Atención
            </h3>
            <span className={`${styles.estado} ${estadoClase}`}>
              <i aria-hidden />
              {estadoTexto}
            </span>
          </div>

          <div className={`${styles.caja} ${styles.mensaje}`}>
            <MessageSquareText size={20} aria-hidden />
            <div>
              {alerta.estado === 'pendiente' && (
                <>
                  <p>Pendiente de atención por el equipo de coordinación.</p>
                  <small>La notificación fue canalizada automáticamente al coordinador zonal asignado.</small>
                </>
              )}
              {alerta.estado === 'en_atencion' && (
                <>
                  <p>Un miembro del equipo está atendiendo este caso.</p>
                  <small>Marca la alerta como atendida cuando se resuelva.</small>
                </>
              )}
              {alerta.estado === 'atendida' && (
                <>
                  <p>
                    Atendida{quienAtendio ? ` por ${nombreCompleto(quienAtendio)}` : ''}.
                  </p>
                  {alerta.notaAtencion && <small>{alerta.notaAtencion}</small>}
                </>
              )}
            </div>
          </div>

          <div className={styles.form}>
            <div className={styles.switchFila}>
              <label htmlFor={idSwitch} className={styles.switchLabel}>
                Marcar como atendida
              </label>
              <Switch id={idSwitch} checked={atendida} onChange={setAtendida} />
            </div>
            <TextareaField
              label="Nota de atención"
              placeholder="Describe la acción realizada o el seguimiento acordado…"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              error={error}
              maxLength={500}
              required={cierraAhora}
            />
            <div className={styles.acciones}>
              <Button fullWidth onClick={guardar}>
                {cierraAhora ? 'Guardar y marcar atendida' : 'Guardar cambios'}
              </Button>
              {alerta.estado === 'pendiente' && !atendida && (
                <Button fullWidth variant="outline" onClick={ponerEnAtencion}>
                  Marcar en atención
                </Button>
              )}
              {esCoordinador && (
                <ButtonLink fullWidth variant="soft" to={`${base}/visitas/programar?adulto=${adulto.id}`} icon={<CalendarClock size={22} aria-hidden />}>
                  Programar visita
                </ButtonLink>
              )}
            </div>
          </div>
        </section>
      </div>
    </Page>
  )
}
