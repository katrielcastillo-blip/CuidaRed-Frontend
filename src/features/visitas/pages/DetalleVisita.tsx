import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Ban, UserRoundPen } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { fechaCorta, hhmmA12, hora12 } from '@/domain/dates'
import { mutate, useDB } from '@/domain/store'
import type { Adulto, Visita } from '@/domain/types'
import { Badge, Button, ButtonLink, EmptyState, SelectField, Sheet, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoHeader } from '../components/AdultoHeader'
import { EvidenciasLista } from '../components/EvidenciasLista'
import { ESTADO_VISITA, estadoAdulto, estiloPunto } from '../lib/dominio'
import comun from './Comun.module.css'
import styles from './DetalleVisita.module.css'

/** Detalle Visita: cuidador (Figma 358:2516) y coordinador (491:3012). */
export function DetalleVisita() {
  const { visitaId } = useParams()
  const visitas = useDB((s) => s.visitas)
  const adultos = useDB((s) => s.adultos)
  const visita = useMemo(() => visitas.find((v) => v.id === visitaId), [visitas, visitaId])
  const adulto = useMemo(() => adultos.find((a) => a.id === visita?.adultoId), [adultos, visita])

  if (!visita || !adulto) {
    return (
      <Page title="Detalle Visita" back>
        <div className={comun.vacio}>
          <EmptyState title="Visita no encontrada" text="La visita que buscas no existe o fue eliminada." />
        </div>
      </Page>
    )
  }
  return <Contenido visita={visita} adulto={adulto} />
}

function Contenido({ visita, adulto }: { visita: Visita; adulto: Adulto }) {
  const { user } = useSession()
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const usuarios = useDB((s) => s.usuarios)

  const esCoord = user?.rol === 'coordinador'
  const responsable = usuarios.find((u) => u.id === visita.cuidadorId)
  const estado = ESTADO_VISITA[visita.estado]
  const abierta = visita.estado === 'pendiente' || visita.estado === 'en_curso'
  const puedeActuar = abierta && (esCoord || visita.cuidadorId === user?.id)

  const [panel, setPanel] = useState<'reasignar' | 'cancelar' | null>(null)
  const [nuevoCuidador, setNuevoCuidador] = useState(visita.cuidadorId)
  const cuidadores = useMemo(
    () => usuarios.filter((u) => u.rol === 'cuidador' && u.estado === 'activo' && u.orgId === user?.orgId),
    [usuarios, user?.orgId],
  )

  function iniciar() {
    mutate((db) => {
      const v = db.visitas.find((x) => x.id === visita.id)
      if (v && v.estado === 'pendiente') {
        v.estado = 'en_curso'
        v.inicio = new Date().toISOString()
      }
    })
    navigate(`${base}/visitas/nueva?visita=${visita.id}`)
  }

  function reasignar() {
    mutate((db) => {
      const v = db.visitas.find((x) => x.id === visita.id)
      if (v) v.cuidadorId = nuevoCuidador
    })
    setPanel(null)
    toast('Visita reasignada correctamente')
  }

  function cancelar() {
    mutate((db) => {
      const v = db.visitas.find((x) => x.id === visita.id)
      if (v && (v.estado === 'pendiente' || v.estado === 'en_curso')) v.estado = 'cancelada'
    })
    setPanel(null)
    toast('Visita cancelada')
  }

  const perfilTo = `${base}/adultos/${adulto.id}`
  const resultado = visita.estadoAdulto ? estadoAdulto(visita.estadoAdulto) : null

  return (
    <Page title="Detalle Visita" back>
      <div className={comun.cuerpo}>
        <AdultoHeader
          adulto={adulto}
          badge="final"
          enlace={{ to: perfilTo, texto: esCoord ? 'Ver perfil completo' : 'Ver Perfil' }}
        />

        <section className={comun.bloque} aria-label="Datos de la visita">
          <h2 className={comun.titulo}>{visita.tipo}</h2>
          <p className={comun.estado} style={estiloPunto(estado.dot)}>
            <span className={comun.punto} aria-hidden />
            {estado.label}
          </p>
          <ul className={comun.meta}>
            <li>Fecha: {fechaCorta(visita.fecha)}</li>
            <li>Hora Pautada: {hhmmA12(visita.horaPautada)}</li>
            {visita.inicio && <li>Hora Inicio: {hora12(visita.inicio)}</li>}
            {visita.fin && <li>Hora Fin: {hora12(visita.fin)}</li>}
            {esCoord && responsable && <li>Responsable: {nombreCompleto(responsable)}</li>}
          </ul>
        </section>

        {visita.notas && (
          <section className={comun.panel} aria-labelledby="notas-titulo">
            <h3 className={comun.subtitulo} id="notas-titulo">
              Notas
            </h3>
            <p className={comun.caja}>{visita.notas}</p>
          </section>
        )}

        {visita.estado === 'completada' && (
          <>
            {resultado && (
              <section className={comun.bloque} aria-label="Estado del adulto">
                <h3 className={comun.subtitulo}>Estado del adulto</h3>
                <p className={`${styles.resultado} ${styles[resultado.tone]}`}>
                  <resultado.icon size={22} aria-hidden />
                  {resultado.label}
                </p>
              </section>
            )}
            <section className={comun.panel} aria-labelledby="obs-titulo">
              <h3 className={comun.subtitulo} id="obs-titulo">
                Observaciones
              </h3>
              <p className={comun.caja}>{visita.observaciones?.trim() || 'Sin observaciones registradas.'}</p>
            </section>
            <section className={comun.bloque} aria-label="Evidencias">
              <h3 className={comun.subtitulo}>Evidencias</h3>
              {visita.evidencias.length > 0 ? (
                <EvidenciasLista items={visita.evidencias} />
              ) : (
                <p className="muted text-sm">No se adjuntaron evidencias.</p>
              )}
            </section>
          </>
        )}

        {visita.estado === 'cancelada' && (
          <Badge tone="neutral">VISITA CANCELADA</Badge>
        )}

        {puedeActuar && (
          <div className={comun.acciones}>
            <Button variant={esCoord ? 'primary' : 'soft'} fullWidth onClick={iniciar}>
              {visita.estado === 'en_curso' ? (esCoord ? 'Continuar visita' : 'Continuar Visita') : esCoord ? 'Iniciar visita' : 'Iniciar Visita'}
            </Button>
          </div>
        )}
        {puedeActuar && esCoord && (
          <div className={comun.acciones}>
            <Button variant="outline" fullWidth icon={<UserRoundPen size={20} aria-hidden />} onClick={() => setPanel('reasignar')}>
              Reasignar
            </Button>
            <Button variant="danger-soft" fullWidth icon={<Ban size={20} aria-hidden />} onClick={() => setPanel('cancelar')}>
              Cancelar visita
            </Button>
          </div>
        )}
        {!puedeActuar && abierta && (
          <ButtonLink variant="outline" fullWidth to={perfilTo}>
            Ver perfil del adulto
          </ButtonLink>
        )}
      </div>

      <Sheet
        open={panel === 'reasignar'}
        onClose={() => setPanel(null)}
        title="Reasignar visita"
        footer={
          <>
            <Button variant="outline" onClick={() => setPanel(null)}>
              Cancelar
            </Button>
            <Button onClick={reasignar} disabled={nuevoCuidador === visita.cuidadorId}>
              Reasignar
            </Button>
          </>
        }
      >
        <SelectField
          label="Cuidador responsable"
          value={nuevoCuidador}
          onChange={(e) => setNuevoCuidador(e.target.value)}
          options={cuidadores.map((c) => ({ value: c.id, label: nombreCompleto(c) }))}
        />
      </Sheet>

      <Sheet
        open={panel === 'cancelar'}
        onClose={() => setPanel(null)}
        title="Cancelar visita"
        footer={
          <>
            <Button variant="outline" onClick={() => setPanel(null)}>
              Volver
            </Button>
            <Button variant="danger" onClick={cancelar}>
              Cancelar visita
            </Button>
          </>
        }
      >
        <p>
          ¿Seguro que quieres cancelar la visita de <strong>{nombreCompleto(adulto)}</strong> del {fechaCorta(visita.fecha)}? Esta acción no se puede deshacer.
        </p>
      </Sheet>
    </Page>
  )
}
