import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Sheet, useToast } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { useDB } from '@/domain/store'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoForm } from '../components/AdultoForm'
import { AdultoNoEncontrado } from '../components/Piezas'
import { actualizarAdulto, cambiarEstadoAdulto, valoresDesdeAdulto, type AdultoFormValues } from '../lib/adultos'
import { nombreAdulto } from '../lib/formato'
import { useVolver } from '../lib/navegacion'
import styles from './AdultoEditarPage.module.css'

/** Editar Adulto Mayor (Figma 441:2041 admin · 487:1137 coordinador): mismo formulario, precargado. */
export default function AdultoEditarPage() {
  const { adultoId } = useParams()
  const { base } = useShell()
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const adulto = useDB((s) => s.adultos.find((a) => a.id === adultoId && a.orgId === user.orgId))
  const { back, volver } = useVolver(`${base}/adultos/${adultoId}`)
  const [confirmar, setConfirmar] = useState(false)
  const cerrar = useCallback(() => setConfirmar(false), [])

  if (!adulto) {
    return (
      <Page title="Adultos Mayores" back={`${base}/adultos`} hideAvatar>
        <AdultoNoEncontrado volverA={`${base}/adultos`} />
      </Page>
    )
  }

  const guardar = (v: AdultoFormValues) => {
    actualizarAdulto(adulto.id, v)
    toast('Cambios guardados')
    volver()
  }

  const inactivo = adulto.estado === 'inactivo'
  const cambiarEstado = () => {
    cambiarEstadoAdulto(adulto.id, inactivo ? 'activo' : 'inactivo')
    setConfirmar(false)
    toast(inactivo ? `${nombreAdulto(adulto)} fue reactivado` : `${nombreAdulto(adulto)} fue desactivado`)
    if (!inactivo) navigate(`${base}/adultos`, { replace: true })
  }

  return (
    <Page title="Adultos Mayores" back={back} hideAvatar>
      <AdultoForm
        key={adulto.id}
        titulo="Editar Adulto Mayor"
        editando
        idActual={adulto.id}
        inicial={valoresDesdeAdulto(adulto)}
        enviarTexto="Guardar cambios"
        onSubmit={guardar}
        onCancel={volver}
        extra={
          <div className={styles.estado}>
            <Button variant={inactivo ? 'soft' : 'danger-soft'} fullWidth onClick={() => setConfirmar(true)}>
              {inactivo ? 'Reactivar adulto' : 'Desactivar adulto'}
            </Button>
          </div>
        }
      />

      <Sheet
        open={confirmar}
        onClose={cerrar}
        title={inactivo ? 'Reactivar adulto' : 'Desactivar adulto'}
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
            ? `${nombreAdulto(adulto)} volverá a aparecer en el listado de adultos activos y en los reportes.`
            : `${nombreAdulto(adulto)} dejará de aparecer en el listado de adultos activos y en los conteos de los reportes. Su historial se conserva y puedes reactivarlo cuando quieras.`}
        </p>
      </Sheet>
    </Page>
  )
}
