import { Page } from '@/layouts/AppShell'
import { EmptyState } from '@/components/ui'

/** Marcador temporal mientras se implementa una pantalla. Debe desaparecer al terminar. */
export function Placeholder({ name, inShell = true }: { name: string; inShell?: boolean }) {
  const body = <EmptyState title={name} text="Pantalla en construcción" />
  return inShell ? <Page title={name}>{body}</Page> : body
}
