/*
 * AdultoNuevoPage.tsx — Registrar perfil de adulto mayor (CU-02 · RF-01 · RF-06).
 * Flujo principal: formulario en tres pasos → validación → registro por la capa de servicios (Envejeciente +
 * Contacto_emergencia principal + Env_Riesgo inicial) → confirmación "Perfil registrado correctamente" →
 * vuelve al listado de perfiles con el nuevo resaltado. La provincia y el municipio se precargan con los de la
 * organización (Cuenta.Municipio_Cod).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuccessOverlay } from '@/components/ui'
import { crearAdulto, DATOS_ADULTO_VACIOS } from '@/domain/api'
import { useSession, useUser } from '@/domain/auth'
import { useDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoForm } from '../components/AdultoForm'
import { nombreAdulto } from '../lib/formato'
import { useVolver } from '../lib/navegacion'

export default function AdultoNuevoPage() {
  const { base } = useShell()
  const user = useUser()
  const navigate = useNavigate()
  const { back, volver } = useVolver(`${base}/adultos`)
  const [creado, setCreado] = useState<Adulto | null>(null)
  const { org } = useSession()
  const municipios = useDB((s) => s.catalogos.municipios)
  const inicial = useMemo(() => {
    const m = municipios.find((x) => x.cod === org?.municipioCod)
    return m ? { ...DATOS_ADULTO_VACIOS, provinciaCod: m.provinciaCod, municipioCod: m.cod } : DATOS_ADULTO_VACIOS
  }, [municipios, org?.municipioCod])

  const alListado = () => navigate(`${base}/adultos`, { replace: true, state: { resaltar: creado?.id } })

  return (
    <Page title="Nuevo perfil" back={back} hideAvatar>
      <AdultoForm
        claveBorrador="adulto:nuevo"
        inicial={inicial}
        titulo="Registrar adulto mayor"
        intro="Completa los datos para registrar el perfil y comenzar su seguimiento. Lo que escribas no se pierde si sales de la pantalla."
        enviarTexto="Registrar"
        onGuardar={(d) => crearAdulto(user, d)}
        onExito={(a) => setCreado(a)}
        onCancel={volver}
      />
      <SuccessOverlay
        open={!!creado}
        message="Perfil registrado correctamente"
        detail={creado ? `${nombreAdulto(creado)} ya aparece en el listado. Desde su perfil puedes agregar más contactos, asignar voluntarios y familiares, y realizar la evaluación de riesgo.` : undefined}
        duration={2600}
        onDone={alListado}
      />
    </Page>
  )
}
