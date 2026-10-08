import { Page, useShell } from '@/layouts/AppShell'
import { ButtonLink, EmptyState } from '@/components/ui'

/** Se muestra cuando el id de la URL no existe o pertenece a otra familia. */
export function NoEncontrado({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  const { base } = useShell()
  return (
    <Page title={titulo} back={base}>
      <EmptyState
        title="No encontramos lo que buscas"
        text={mensaje}
        action={<ButtonLink to={base}>Volver al inicio</ButtonLink>}
      />
    </Page>
  )
}
