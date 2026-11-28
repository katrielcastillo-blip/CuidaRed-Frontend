/*
 * SinDatos.tsx — Qué mostrar cuando una consulta del Portal Familiar aún no tiene datos: cargando, "No
 * encontrado o sin permiso" (sin distinguir los dos casos) o fallo de carga. Con `titulo` ocupa la pantalla
 * completa; sin él, se inserta en una sección. Con los datos locales de hoy casi nunca se ve; con la API sí.
 * Módulo: familiar.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Page, useShell } from '@/layouts/AppShell'
import { EmptyState, Spinner } from '@/components/ui'
import type { ConsultaPendiente } from '../lib/modelos'
import { NoEncontrado } from './NoEncontrado'

export function SinDatos({ consulta, titulo }: { consulta: ConsultaPendiente; titulo?: string }) {
  const { base } = useShell()
  if (consulta.estado === 'error' && consulta.tipo === 'no_encontrado') {
    return titulo ? (
      <NoEncontrado titulo={titulo} />
    ) : (
      <EmptyState title="No encontrado o sin permiso" text="No existe o no tienes autorización para consultarlo en esta cuenta." />
    )
  }
  const contenido =
    consulta.estado === 'cargando' ? (
      <div className="grid place-items-center py-10">
        <Spinner />
      </div>
    ) : (
      <EmptyState title="No se pudo cargar la información" text={consulta.mensaje} />
    )
  return titulo ? (
    <Page title={titulo} back={base}>
      {contenido}
    </Page>
  ) : (
    contenido
  )
}
