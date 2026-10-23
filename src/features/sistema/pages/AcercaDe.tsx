/*
 * AcercaDe.tsx — "Acerca de CuidaRed": versión, equipo, contexto académico, descargo y créditos de
 * tecnologías de terceros con su licencia.
 * Módulo: sistema (SRS §18.3 "Pantalla Acerca de" · §18.5 versionado · §18.6 reconocimiento institucional ·
 * §15 descargo y propiedad intelectual · §17.4 licencias de terceros).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, GraduationCap, ShieldCheck, Siren, Users } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Page } from '@/layouts/AppShell'
import { PRODUCTO } from '@/lib/proyecto'

/** Componentes de terceros incluidos en la aplicación (versión mayor según package.json). */
const TERCEROS: Array<{ nombre: string; uso: string; licencia: string }> = [
  { nombre: 'React 19', uso: 'Biblioteca de interfaz de usuario', licencia: 'MIT' },
  { nombre: 'React Router 7', uso: 'Navegación entre pantallas', licencia: 'MIT' },
  { nombre: 'Vite 8', uso: 'Herramienta de construcción', licencia: 'MIT' },
  { nombre: 'Tailwind CSS 4', uso: 'Estilos, paleta y tipografía', licencia: 'MIT' },
  { nombre: 'Lucide (lucide-react)', uso: 'Iconos del sistema', licencia: 'ISC' },
  { nombre: 'vite-plugin-pwa / Workbox', uso: 'Instalación como app y funcionamiento sin conexión', licencia: 'MIT' },
  { nombre: 'Fuente Inter', uso: 'Tipografía de la interfaz', licencia: 'SIL Open Font License 1.1' },
]

function Bloque({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-line-soft bg-surface p-5 shadow-1" aria-label={titulo}>
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-navy">
        <span className="grid size-9 flex-none place-items-center rounded-md bg-blue-100" aria-hidden>
          {icono}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

const ENLACE_FILA = 'flex min-h-12 items-center gap-3 rounded-sm px-3 font-semibold text-navy hover:bg-blue-100'

export default function AcercaDe() {
  return (
    <Page title="Acerca de CuidaRed" back>
      <header className="flex flex-col items-center gap-3 rounded-lg bg-[linear-gradient(180deg,#ffffff_0%,#e6f1fb_100%)] px-5 py-7 text-center shadow-1">
        <img src="/brand/logo.png" alt="CuidaRed · Seguimiento Comunitario" width={517} height={192} className="h-auto w-[min(260px,80%)]" />
        <p className="flex flex-wrap items-center justify-center gap-2 text-ink-2">
          <Badge tone="navy">Versión {PRODUCTO.version}</Badge>
          <span>MVP académico · {PRODUCTO.anio}</span>
        </p>
        <p className="max-w-prose text-pretty text-ink-2">
          Plataforma web progresiva para que organizaciones comunitarias de la República Dominicana coordinen el seguimiento de adultos mayores en situación de
          vulnerabilidad: perfiles, visitas, necesidades, alertas, resumen y reportes, incluso sin conexión.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-md border border-warning bg-warning-100 px-4 py-3 text-[#5c3a00]" role="note">
        <Siren size={22} className="mt-0.5 flex-none" aria-hidden />
        <p className="text-pretty text-sm leading-normal">
          <strong className="block text-base">Descargo de responsabilidad</strong>
          {PRODUCTO.descargo} El software, en su versión MVP, se proporciona "tal cual" (as is) para fines de evaluación académica y pilotaje, sin garantías comerciales sobre su
          continuidad operativa.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Bloque icono={<Users size={20} />} titulo="Equipo de desarrollo">
          <p className="font-semibold text-ink">{PRODUCTO.equipo}</p>
          <ul className="flex flex-col gap-1 text-ink-2">
            {PRODUCTO.integrantes.map((n) => (
              <li key={n} className="flex items-center gap-2">
                <span className="size-1.5 flex-none rounded-full bg-teal" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        </Bloque>

        <Bloque icono={<GraduationCap size={20} />} titulo="Contexto académico">
          <p className="text-pretty text-ink-2">
            Proyecto desarrollado en el marco del <strong className="text-ink">{PRODUCTO.institucion}</strong>, curso <strong className="text-ink">{PRODUCTO.curso}</strong>.
          </p>
          <p className="text-sm text-muted">
            El nombre y el logotipo del INTEC son propiedad exclusiva de la institución y se mencionan solo en contexto académico. "CuidaRed" y su logotipo identifican el proyecto
            estudiantil y no son una marca comercial registrada.
          </p>
        </Bloque>
      </div>

      <Bloque icono={<FileText size={20} />} titulo="Tecnologías de terceros">
        <p className="text-sm text-ink-2">CuidaRed se construye con software de código abierto. Agradecemos a sus autores; cada componente conserva su licencia original.</p>
        <ul className="divide-y divide-line-soft overflow-hidden rounded-sm border border-line-soft">
          {TERCEROS.map((t) => (
            <li key={t.nombre} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-bg px-3.5 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-ink">{t.nombre}</span>
                <span className="text-sm text-muted">{t.uso}</span>
              </span>
              <Badge tone="info">{t.licencia}</Badge>
            </li>
          ))}
        </ul>
      </Bloque>

      <Bloque icono={<ShieldCheck size={20} />} titulo="Avisos legales">
        <nav aria-label="Avisos legales" className="-mx-1 flex flex-col">
          <Link to="/terminos" className={ENLACE_FILA}>
            <span className="flex-1">Términos y Condiciones</span>
            <ChevronRight size={20} aria-hidden />
          </Link>
          <Link to="/privacidad" className={ENLACE_FILA}>
            <span className="flex-1">Política de Privacidad</span>
            <ChevronRight size={20} aria-hidden />
          </Link>
        </nav>
      </Bloque>

      <p className="text-center text-sm text-muted">
        {PRODUCTO.copyright}
        <br />
        Desarrollado en el {PRODUCTO.institucion}.
      </p>
    </Page>
  )
}
