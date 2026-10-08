import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoForm } from '../components/AdultoForm'
import { crearAdulto, type AdultoFormValues } from '../lib/adultos'
import { useVolver } from '../lib/navegacion'

/** Agregar Adulto Mayor (Figma 417:653 admin · 487:1000 coordinador). Tras guardar lleva a la evaluación inicial. */
export default function AdultoNuevoPage() {
  const { base } = useShell()
  const user = useUser()
  const navigate = useNavigate()
  const toast = useToast()
  const { back, volver } = useVolver(`${base}/adultos`)

  const guardar = (v: AdultoFormValues) => {
    const id = crearAdulto(v, user.orgId)
    toast('Perfil guardado. Completa la evaluación inicial.')
    navigate(`${base}/adultos/${id}/riesgo`, { replace: true, state: { desde: 'nuevo' } })
  }

  return (
    <Page title="Adultos Mayores" back={back} hideAvatar>
      <AdultoForm
        titulo="Agregar Adulto Mayor"
        intro="Completa los datos del adulto mayor para registrarlo en el sistema y comenzar su seguimiento."
        enviarTexto="Guardar perfil"
        onSubmit={guardar}
        onCancel={volver}
      />
    </Page>
  )
}
