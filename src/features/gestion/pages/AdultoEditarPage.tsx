/*
 * AdultoEditarPage.tsx — Editar perfil de adulto mayor (CU-03 · RF-01): Envejeciente, contacto principal y
 * clasificación de riesgo (un cambio de nivel queda en Env_Riesgo); desactivar / reactivar (Env_Estado) y
 * anonimizar perfiles inactivos según la política de retención (SRS §8.2.2.3.4 f).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EyeOff, Power, PowerOff } from 'lucide-react'
import { Badge, Button, Checkbox, Sheet, useToast } from '@/components/ui'
import { actualizarAdulto, anonimizarAdulto, cambiarEstadoAdulto, datosDesdeAdulto } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { alcanzaAdulto, puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoForm } from '../components/AdultoForm'
import { NoEncontrado, NotaInfo, Seccion } from '../components/Piezas'
import { nombreAdulto } from '../lib/formato'
import { useVolver } from '../lib/navegacion'

export default function AdultoEditarPage() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const adultos = useDB((s) => s.adultos)
  const adulto = useMemo(() => adultos.find((a) => a.id === adultoId && alcanzaAdulto(user, a)), [adultos, adultoId, user])

  if (!adulto) {
    return (
      <Page title="Editar perfil" back={`${base}/adultos`} hideAvatar>
        <NoEncontrado volverA={`${base}/adultos`} que="este perfil" />
      </Page>
    )
  }
  return <Editar key={adulto.id} adulto={adulto} />
}

type Confirmacion = 'estado' | 'anonimizar' | null

function Editar({ adulto }: { adulto: Adulto }) {
  const { base } = useShell()
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const enLinea = useEnLinea()
  const perfil = `${base}/adultos/${adulto.id}`
  const { back, volver } = useVolver(perfil)
  const [confirmar, setConfirmar] = useState<Confirmacion>(null)
  const [entendido, setEntendido] = useState(false)
  const cerrar = useCallback(() => {
    setConfirmar(null)
    setEntendido(false)
  }, [])
  const inicial = useMemo(() => datosDesdeAdulto(adulto), [adulto])

  const inactivo = adulto.estado === 'inactivo'
  const puedeEstado = puede(user, 'adultos:desactivar', adulto) && !adulto.anonimizado
  const puedeAnonimizar = puede(user, 'adultos:anonimizar', adulto) && inactivo && !adulto.anonimizado

  const cambiarEstado = () => {
    const r = cambiarEstadoAdulto(user, adulto.id, inactivo ? 'activo' : 'inactivo')
    cerrar()
    if (!r.ok) return toast(r.error, 'error')
    toast(inactivo ? `${nombreAdulto(adulto)} fue reactivado` : `${nombreAdulto(adulto)} fue desactivado`)
  }

  const anonimizar = () => {
    const r = anonimizarAdulto(user, adulto.id)
    cerrar()
    if (!r.ok) return toast(r.error, 'error')
    toast('Perfil anonimizado. Sus registros se conservan solo para estadísticas.')
    navigate(`${base}/adultos`, { replace: true })
  }

  return (
    <Page title="Editar perfil" back={back} hideAvatar>
      {adulto.anonimizado ? (
        <NotaInfo tono="aviso">Este perfil fue anonimizado según la política de retención y ya no se puede editar.</NotaInfo>
      ) : (
        <AdultoForm
          claveBorrador={`adulto:editar:${adulto.id}`}
          inicial={inicial}
          idActual={adulto.id}
          titulo={`Editar a ${nombreAdulto(adulto)}`}
          enviarTexto="Guardar"
          onGuardar={(d) => actualizarAdulto(user, adulto.id, d)}
          onExito={() => {
            toast('Cambios guardados correctamente')
            navigate(perfil, { replace: true })
          }}
          onCancel={volver}
        />
      )}

      {(puedeEstado || puedeAnonimizar) && (
        <Seccion titulo="Estado del perfil" id="estado-perfil" className="w-full max-w-form mx-auto pt-4 border-t border-line-soft" accion={<Badge tone={inactivo ? 'neutral' : 'success'}>{inactivo ? 'Inactivo' : 'Activo'}</Badge>}>
          <p className="text-sm text-ink-2">
            {inactivo
              ? 'El perfil está inactivo: no aparece en el resumen ni genera alertas. Su historial se conserva.'
              : 'Desactiva el perfil si la persona ya no recibe seguimiento (mudanza, fallecimiento, baja voluntaria). Su historial se conserva.'}
          </p>
          {!enLinea && <p className="text-sm text-warning-700 font-semibold">Sin conexión: estas acciones necesitan internet.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {puedeEstado && (
              <Button variant={inactivo ? 'soft' : 'danger-soft'} disabled={!enLinea} icon={inactivo ? <Power size={20} aria-hidden /> : <PowerOff size={20} aria-hidden />} onClick={() => setConfirmar('estado')}>
                {inactivo ? 'Reactivar perfil' : 'Desactivar perfil'}
              </Button>
            )}
            {puedeAnonimizar && (
              <Button variant="danger" disabled={!enLinea} icon={<EyeOff size={20} aria-hidden />} onClick={() => setConfirmar('anonimizar')}>
                Anonimizar perfil
              </Button>
            )}
          </div>
        </Seccion>
      )}

      <Sheet
        open={confirmar === 'estado'}
        onClose={cerrar}
        title={inactivo ? 'Reactivar perfil' : 'Desactivar perfil'}
        footer={
          <>
            <Button variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button variant={inactivo ? 'primary' : 'danger'} onClick={cambiarEstado}>
              {inactivo ? 'Reactivar' : 'Desactivar'}
            </Button>
          </>
        }
      >
        <p>
          {inactivo
            ? `${nombreAdulto(adulto)} volverá a aparecer en el resumen de seguimiento, en los reportes y en las reglas de alertas.`
            : `${nombreAdulto(adulto)} dejará de aparecer en el resumen de seguimiento y no generará nuevas alertas; las alertas automáticas abiertas se cerrarán. Su historial se conserva y puedes reactivarlo cuando quieras.`}
        </p>
      </Sheet>

      <Sheet
        open={confirmar === 'anonimizar'}
        onClose={cerrar}
        title="Anonimizar perfil"
        footer={
          <>
            <Button variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={!entendido} onClick={anonimizar}>
              Anonimizar
            </Button>
          </>
        }
      >
        <p>
          Se eliminarán de forma <b>permanente</b> los datos que identifican a {nombreAdulto(adulto)}: nombre, cédula, teléfono, dirección, contactos de emergencia, vínculos con
          voluntarios y familiares, condición general, evaluación de riesgo, observaciones de visitas y riesgos, indicaciones y descripciones de necesidades.
        </p>
        <p className="text-sm text-ink-2">Las visitas, necesidades y alertas se conservan sin datos personales para las estadísticas (política de retención, SRS §8.2.2.3.4 f).</p>
        <NotaInfo tono="aviso">Esta acción no se puede deshacer.</NotaInfo>
        <Checkbox label="Entiendo que la anonimización es irreversible." checked={entendido} onChange={(e) => setEntendido(e.target.checked)} />
      </Sheet>
    </Page>
  )
}
