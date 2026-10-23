/*
 * PieDePagina.tsx — Pie de página de las pantallas de escritorio: copyright, año, mención al INTEC y
 * enlaces a los avisos legales y de privacidad (SRS §18.3 "Pie de página" y §18.6).
 * Módulo: layouts.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Link } from 'react-router-dom'
import { useShell } from './AppShell'

export const ANIO_COPYRIGHT = 2026

export function PieDePagina() {
  const { base } = useShell()
  return (
    <footer className="hidden md:block mt-8 border-t border-line-soft bg-surface no-print">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3 text-xs text-muted">
        <p>
          © {ANIO_COPYRIGHT} Equipo CuidaRed – INTEC. Todos los derechos reservados. Proyecto académico del Instituto Tecnológico de Santo Domingo (INTEC).
        </p>
        <p className="font-semibold">CuidaRed no sustituye servicios médicos, instituciones públicas ni organismos de emergencia.</p>
        <nav className="flex gap-1 ml-auto" aria-label="Avisos legales">
          <Link className="inline-flex items-center min-h-12 px-2 underline hover:text-navy" to="/terminos">
            Términos de uso
          </Link>
          <Link className="inline-flex items-center min-h-12 px-2 underline hover:text-navy" to="/privacidad">
            Privacidad
          </Link>
          <Link className="inline-flex items-center min-h-12 px-2 underline hover:text-navy" to={`${base}/acerca`}>
            Acerca de CuidaRed
          </Link>
        </nav>
      </div>
    </footer>
  )
}
