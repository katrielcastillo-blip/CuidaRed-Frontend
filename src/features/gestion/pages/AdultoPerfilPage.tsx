import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Cake, CircleUserRound, MapPin, Phone, UsersRound, VenusAndMars, X } from 'lucide-react'
import { Avatar, Badge, Button, ButtonLink, Checkbox, Datum, EmptyState, InfoRow, Segmented, Sheet, useToast } from '@/components/ui'
import { nombreCompleto, useUser } from '@/domain/auth'
import { edad, fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto, Alerta, Necesidad, Visita } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoNoEncontrado, RiesgoPill } from '../components/Piezas'
import { asignarCuidadores } from '../lib/adultos'
import { cuidadoresActivos, nombreUsuario, necesidadesActivas, ultimaVisitaCompletada } from '../lib/datos'
import {
  ESTADO_ALERTA_TEXTO,
  ESTADO_NECESIDAD_TEXTO,
  ESTADO_VISITA_TEXTO,
  nombreAdulto,
  PESO_SEVERIDAD,
  TIPO_NECESIDAD_TEXTO,
} from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import styles from './AdultoPerfilPage.module.css'

type Pestana = 'necesidades' | 'visitas' | 'alertas'
type Detalle = { tipo: 'necesidad'; id: string } | { tipo: 'visita'; id: string } | null

const fechaHora = (iso: string) => `${fechaCorta(iso)} - ${hora12(iso)}`

/** Tarjeta de actividad: enlaza a su detalle (coordinador) o abre un Sheet (admin, que no tiene esas rutas). */
function ItemCard({
  fecha,
  badge,
  titulo,
  texto,
  to,
  onOpen,
}: {
  fecha: string
  badge: ReactNode
  titulo: string
  texto?: string
  to?: string
  onOpen?: () => void
}) {
  const contenido = (
    <>
      <div className={styles.itemCuerpo}>
        <div className={styles.itemTop}>
          <span className={styles.itemFecha}>{fecha}</span>
          {badge}
        </div>
        <strong className={styles.itemTitulo}>{titulo}</strong>
        {texto && <span className={styles.itemTexto}>{texto}</span>}
      </div>
      <div className={styles.itemPie}>
        <span>Ver más</span>
        <ArrowRight size={18} aria-hidden />
      </div>
    </>
  )
  return to ? (
    <Link to={to} className={styles.item}>
      {contenido}
    </Link>
  ) : (
    <button type="button" className={styles.item} onClick={onOpen}>
      {contenido}
    </button>
  )
}

const tonoNecesidad = { activa: 'danger', satisfecha: 'success', inactiva: 'neutral' } as const
const tonoVisita = { completada: 'success', pendiente: 'warning', en_curso: 'info', cancelada: 'neutral' } as const
const tonoAlerta = { pendiente: 'danger', en_atencion: 'warning', atendida: 'success' } as const

/** Perfil Envejeciente (Figma 408:1743 admin · 487:1315 coordinador). */
export default function AdultoPerfilPage() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const { back } = useVolver(`${base}/adultos`)
  const adulto = useDB((s) => s.adultos.find((a) => a.id === adultoId && a.orgId === user.orgId))

  if (!adulto) {
    return (
      <Page title="Perfil Envejeciente" back={`${base}/adultos`} hideAvatar>
        <AdultoNoEncontrado volverA={`${base}/adultos`} />
      </Page>
    )
  }
  return <Perfil adulto={adulto} back={back} />
}

function Perfil({ adulto, back }: { adulto: Adulto; back: boolean | string }) {
  const { base } = useShell()
  const user = useUser()
  const toast = useToast()
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const alertas = useDB((s) => s.alertas)
  const usuarios = useDB((s) => s.usuarios)
  const familias = useDB((s) => s.familias)

  const esAdmin = user.rol === 'admin'
  // El coordinador tiene las pantallas de visitas y necesidades; el administrador no (usa un Sheet con el detalle).
  const conRutasDeVisitas = user.rol === 'coordinador'

  const [pestana, setPestana] = useState<Pestana>('necesidades')
  const [detalle, setDetalle] = useState<Detalle>(null)
  const [asignando, setAsignando] = useState(false)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const cerrarDetalle = useCallback(() => setDetalle(null), [])
  const cerrarAsignar = useCallback(() => setAsignando(false), [])

  const misNecesidades = useMemo(() => necesidades.filter((n) => n.adultoId === adulto.id).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)), [necesidades, adulto.id])
  const misVisitas = useMemo(
    () => visitas.filter((v) => v.adultoId === adulto.id).sort((a, b) => `${b.fecha} ${b.horaPautada}`.localeCompare(`${a.fecha} ${a.horaPautada}`)),
    [visitas, adulto.id],
  )
  const misAlertas = useMemo(
    () =>
      alertas
        .filter((a) => a.adultoId === adulto.id)
        .sort((a, b) => Number(a.estado === 'atendida') - Number(b.estado === 'atendida') || PESO_SEVERIDAD[a.severidad] - PESO_SEVERIDAD[b.severidad] || b.creadaEn.localeCompare(a.creadaEn)),
    [alertas, adulto.id],
  )
  const ultima = ultimaVisitaCompletada(visitas, adulto.id)
  const activas = necesidadesActivas(necesidades, adulto.id).length
  const familia = familias.find((f) => f.id === adulto.familiaId)
  const asignados = adulto.cuidadorIds.map((id) => usuarios.find((u) => u.id === id)).filter((u) => u !== undefined)
  const candidatos = useMemo(() => cuidadoresActivos(usuarios, adulto.orgId), [usuarios, adulto.orgId])

  const abrirAsignar = () => {
    setSeleccion(adulto.cuidadorIds)
    setAsignando(true)
  }
  const guardarAsignacion = () => {
    asignarCuidadores(adulto.id, seleccion)
    setAsignando(false)
    toast('Cuidadores actualizados')
  }
  const quitar = (id: string) => {
    asignarCuidadores(adulto.id, adulto.cuidadorIds.filter((x) => x !== id))
    toast('Cuidador quitado')
  }

  const necesidadDetalle = detalle?.tipo === 'necesidad' ? misNecesidades.find((n) => n.id === detalle.id) : undefined
  const visitaDetalle = detalle?.tipo === 'visita' ? misVisitas.find((v) => v.id === detalle.id) : undefined

  const tarjetaNecesidad = (n: Necesidad) => (
    <ItemCard
      key={n.id}
      fecha={fechaHora(n.creadaEn)}
      badge={<Badge tone={tonoNecesidad[n.estado]}>{n.estado === 'activa' ? 'ACTIVA' : ESTADO_NECESIDAD_TEXTO[n.estado]}</Badge>}
      titulo={TIPO_NECESIDAD_TEXTO[n.tipo]}
      texto={n.descripcion}
      to={conRutasDeVisitas ? `${base}/necesidades/${n.id}` : undefined}
      onOpen={() => setDetalle({ tipo: 'necesidad', id: n.id })}
    />
  )
  const tarjetaVisita = (v: Visita) => (
    <ItemCard
      key={v.id}
      fecha={`${fechaCorta(v.fecha)} - ${hhmmA12(v.horaPautada)}`}
      badge={<Badge tone={tonoVisita[v.estado]}>{ESTADO_VISITA_TEXTO[v.estado]}</Badge>}
      titulo={v.tipo}
      texto={`Cuidador: ${nombreUsuario(usuarios, v.cuidadorId) ?? '—'}`}
      to={conRutasDeVisitas ? `${base}/visitas/${v.id}` : undefined}
      onOpen={() => setDetalle({ tipo: 'visita', id: v.id })}
    />
  )
  const tarjetaAlerta = (a: Alerta) => (
    <ItemCard
      key={a.id}
      fecha={fechaHora(a.creadaEn)}
      badge={<Badge tone={tonoAlerta[a.estado]}>{ESTADO_ALERTA_TEXTO[a.estado]}</Badge>}
      titulo={a.titulo}
      texto={a.categoria}
      to={`${base}/alertas/${a.id}`}
    />
  )

  const sinDatos: Record<Pestana, string> = {
    necesidades: 'Sin necesidades registradas.',
    visitas: 'Sin visitas registradas.',
    alertas: 'Sin alertas para este adulto.',
  }
  const cantidad = { necesidades: misNecesidades.length, visitas: misVisitas.length, alertas: misAlertas.length }[pestana]

  return (
    <Page title="Perfil Envejeciente" back={back} hideAvatar wide>
      <div className={styles.layout}>
        {/* Columna 1: datos */}
        <div className={styles.col}>
          <section className={styles.hero} aria-label="Resumen del adulto">
            <CircleUserRound size={112} strokeWidth={1.4} className={styles.avatar} aria-hidden />
            <h2 className={styles.nombre}>{nombreAdulto(adulto)}</h2>
            <p className={styles.cedula}>{adulto.cedula}</p>
            <div className={styles.chips}>
              <RiesgoPill riesgo={adulto.riesgo} />
              {adulto.estado === 'inactivo' && <Badge tone="neutral">Inactivo</Badge>}
            </div>
            <p className={styles.evaluacion}>
              {adulto.evaluacion
                ? `Evaluado el ${fechaCorta(adulto.evaluacion.fecha)} · ${adulto.evaluacion.puntaje} de 100 puntos`
                : 'Aún sin evaluación de riesgo'}
            </p>
          </section>

          <section className="stack" aria-labelledby="info-personal">
            <h2 id="info-personal" className={styles.titulo}>
              Información Personal
            </h2>
            <InfoRow icon={<Cake size={22} aria-hidden />} label="Fecha de Nacimiento" value={`${fechaCorta(adulto.fechaNacimiento)} (${edad(adulto.fechaNacimiento)} años)`} />
            <InfoRow icon={<Phone size={22} aria-hidden />} label="Teléfono" value={adulto.telefono} />
            <InfoRow icon={<VenusAndMars size={22} aria-hidden />} label="Sexo" value={adulto.sexo} />
            <InfoRow icon={<MapPin size={22} aria-hidden />} label="Zona" value={adulto.municipio ? `${adulto.zona} · ${adulto.municipio}` : adulto.zona} />
            <InfoRow icon={<UsersRound size={22} aria-hidden />} label="Familia" value={familia?.nombre ?? '—'} />
            <InfoRow
              icon={<Phone size={22} aria-hidden />}
              label="Contacto de Emergencia"
              value={`${adulto.contactoEmergencia.nombre} · ${adulto.contactoEmergencia.telefono}`}
            />
          </section>

          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Última Visita</span>
              <strong className={styles.tileValor}>{ultima ? fechaCorta(ultima) : 'Sin visitas'}</strong>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Necesidades Activas</span>
              <strong className={styles.tileValor}>{activas}</strong>
            </div>
          </div>
        </div>

        {/* Columna 2: acciones y actividad */}
        <div className={styles.col}>
          {conRutasDeVisitas && (
            <section className="stack" aria-labelledby="registrar">
              <h2 id="registrar" className={styles.titulo}>
                Registrar
              </h2>
              <div className={styles.dosBotones}>
                <ButtonLink variant="soft" to={`${base}/visitas/nueva?adulto=${adulto.id}`}>
                  Visita
                </ButtonLink>
                <ButtonLink variant="soft" to={`${base}/necesidades/nueva?adulto=${adulto.id}`}>
                  Necesidad
                </ButtonLink>
              </div>
            </section>
          )}

          <section className="stack" aria-labelledby="acciones">
            <h2 id="acciones" className={styles.titulo}>
              Acciones Rápidas
            </h2>
            <div className={styles.acciones}>
              <ButtonLink variant="light" fullWidth to={`${base}/adultos/${adulto.id}/editar`}>
                Editar información
              </ButtonLink>
              <ButtonLink variant="light" fullWidth to={`${base}/adultos/${adulto.id}/riesgo`} state={{ desde: 'perfil' }}>
                Realizar evaluación de riesgo
              </ButtonLink>
            </div>
          </section>

          <section className="stack" aria-labelledby="cuidadores">
            <div className="row-between">
              <h2 id="cuidadores" className={styles.titulo}>
                Cuidadores asignados
              </h2>
              {esAdmin && (
                <Button size="sm" variant="light" onClick={abrirAsignar}>
                  Asignar
                </Button>
              )}
            </div>
            {asignados.length === 0 ? (
              <p className="muted text-sm">Este adulto aún no tiene cuidadores asignados.</p>
            ) : (
              <ul className={styles.cuidadores}>
                {asignados.map((c) => (
                  <li key={c.id} className={styles.cuidador}>
                    <Avatar nombre={nombreCompleto(c)} src={c.avatar} size={40} />
                    <span className={styles.cuidadorTexto}>
                      <strong>{nombreCompleto(c)}</strong>
                      <small>
                        {c.etiqueta}
                        {c.estado === 'inactivo' ? ' · Inactivo' : ''}
                      </small>
                    </span>
                    {esAdmin && (
                      <button type="button" className={styles.quitar} aria-label={`Quitar a ${nombreCompleto(c)}`} onClick={() => quitar(c.id)}>
                        <X size={20} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="stack" aria-label="Actividad del adulto">
            <Segmented<Pestana>
              label="Actividad"
              value={pestana}
              onChange={setPestana}
              options={[
                { value: 'necesidades', label: 'Necesidades' },
                { value: 'visitas', label: 'Visitas' },
                { value: 'alertas', label: 'Alertas' },
              ]}
            />
            {cantidad === 0 ? (
              <EmptyState title={sinDatos[pestana]} />
            ) : (
              <div className={styles.lista} role="tabpanel">
                {pestana === 'necesidades' && misNecesidades.map(tarjetaNecesidad)}
                {pestana === 'visitas' && misVisitas.map(tarjetaVisita)}
                {pestana === 'alertas' && misAlertas.map(tarjetaAlerta)}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Detalle de necesidad / visita para el administrador (no tiene pantallas propias) */}
      <Sheet open={!!necesidadDetalle} onClose={cerrarDetalle} title="Detalle de necesidad">
        {necesidadDetalle && (
          <>
            <Datum label="Tipo" value={TIPO_NECESIDAD_TEXTO[necesidadDetalle.tipo]} />
            <Datum label="Estado" value={ESTADO_NECESIDAD_TEXTO[necesidadDetalle.estado]} />
            <Datum label="Descripción" value={necesidadDetalle.descripcion} />
            <Datum label="Registrada por" value={nombreUsuario(usuarios, necesidadDetalle.registradaPor) ?? '—'} />
            <Datum label="Fecha" value={fechaHora(necesidadDetalle.creadaEn)} />
            {necesidadDetalle.satisfechaEn && <Datum label="Satisfecha" value={`${fechaHora(necesidadDetalle.satisfechaEn)} · ${nombreUsuario(usuarios, necesidadDetalle.satisfechaPor) ?? '—'}`} />}
          </>
        )}
      </Sheet>
      <Sheet open={!!visitaDetalle} onClose={cerrarDetalle} title="Detalle de visita">
        {visitaDetalle && (
          <>
            <Datum label="Tipo" value={visitaDetalle.tipo} />
            <Datum label="Estado" value={ESTADO_VISITA_TEXTO[visitaDetalle.estado]} />
            <Datum label="Fecha y hora pautada" value={`${fechaCorta(visitaDetalle.fecha)} - ${hhmmA12(visitaDetalle.horaPautada)}`} />
            <Datum label="Cuidador" value={nombreUsuario(usuarios, visitaDetalle.cuidadorId) ?? '—'} />
            {visitaDetalle.observaciones && <Datum label="Observaciones" value={visitaDetalle.observaciones} />}
            {visitaDetalle.notas && <Datum label="Instrucciones" value={visitaDetalle.notas} />}
          </>
        )}
      </Sheet>

      {/* Asignar cuidadores (solo administrador) */}
      <Sheet
        open={asignando}
        onClose={cerrarAsignar}
        title="Asignar cuidadores"
        footer={
          <>
            <Button variant="outline" onClick={cerrarAsignar}>
              Cancelar
            </Button>
            <Button onClick={guardarAsignacion}>Guardar</Button>
          </>
        }
      >
        <p className="muted text-sm">Cuidadores activos de tu organización. Marca los que acompañarán a {adulto.nombre}.</p>
        {candidatos.length === 0 ? (
          <EmptyState title="No hay cuidadores activos" text="Invita o activa cuidadores desde Miembros." />
        ) : (
          <ul className={styles.candidatos}>
            {candidatos.map((c) => (
              <li key={c.id}>
                <Checkbox
                  checked={seleccion.includes(c.id)}
                  onChange={(e) => setSeleccion((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                  label={
                    <span className={styles.candidato}>
                      <Avatar nombre={nombreCompleto(c)} src={c.avatar} size={36} />
                      <span className={styles.cuidadorTexto}>
                        <strong>{nombreCompleto(c)}</strong>
                        <small>{c.email}</small>
                      </span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </Page>
  )
}

