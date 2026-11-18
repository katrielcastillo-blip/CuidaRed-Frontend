/* PlanesPortada.tsx — Comparación de opciones de cuidado. Módulo auth. © 2026 Equipo CuidaRed – INTEC. */
import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

// Resumen público del catálogo de referencia de CuidaRed.
const grupos = [
  {
    id: 'planes-familias', titulo: 'Para familias', limiteEquipo: 'Familiares',
    descripcion: 'Para quienes se turnan y comparten el seguimiento de un familiar mayor.',
    registro: '/registro-familia', accion: 'Crear cuenta familiar',
    planes: [
      {
        nombre: 'Básico Familiar',
        enfoque: 'Comparte el seguimiento cotidiano con tu familia y las personas que cuidan a tu familiar.',
        personas: 'Hasta 2', equipo: 'Hasta 3', incluye: 'Qué incluye',
        funciones: ['Perfiles de personas mayores', 'Registro de necesidades diarias', 'Acceso compartido según el rol de cada familiar'],
      },
      {
        nombre: 'Cuidado Integral',
        enfoque: 'Da seguimiento a más familiares y recibe avisos sobre situaciones críticas.',
        personas: 'Hasta 6', equipo: 'Sin tope indicado', incluye: 'Todo lo de Básico Familiar, más',
        funciones: ['Alertas críticas en tiempo real', 'Historial de seguimiento que conserva el registro original', 'Panel de indicadores de cuidado'],
      },
    ],
  },
  {
    id: 'planes-organizaciones', titulo: 'Para organizaciones', limiteEquipo: 'Usuarios del equipo',
    descripcion: 'Para centros y programas que coordinan a cuidadores y voluntarios.',
    registro: '/registro-organizacion', accion: 'Registrar mi organización',
    planes: [
      {
        nombre: 'Operación Base',
        enfoque: 'Centraliza los registros del equipo y consulta la actividad del programa.',
        personas: 'Hasta 15', equipo: 'Hasta 20', incluye: 'Qué incluye',
        funciones: ['Registro de visitas y necesidades diarias', 'Tablón de notificaciones', 'Panel de indicadores del programa'],
      },
      {
        nombre: 'Gestión Comunitaria Avanzada',
        enfoque: 'Da seguimiento a un programa con visitas recurrentes y distintos niveles de riesgo.',
        personas: 'Sin tope indicado', equipo: 'Sin tope indicado', incluye: 'Todo lo de Operación Base, más',
        funciones: ['Programación de visitas recurrentes', 'Alertas críticas en tiempo real', 'Clasificación completa de riesgos', 'Gestión de necesidades de la organización', 'Reportes avanzados'],
      },
    ],
  },
]

export function PlanesPortada() {
  return (
    <div className="space-y-8 sm:space-y-10">
      {grupos.map(({ id, titulo, descripcion, limiteEquipo, registro, accion, planes }) => (
        <section key={id} aria-labelledby={id}
          className="grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2 sm:pt-6 lg:grid-cols-[minmax(0,0.68fr)_repeat(2,minmax(0,1fr))] lg:gap-5">
          <header className="sm:col-span-2 lg:col-span-1 lg:row-span-4 lg:pr-2">
            <h3 id={id} className="text-xl font-bold text-navy">{titulo}</h3>
            <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-ink-2">{descripcion}</p>
            <Link to={registro} className="mt-1 inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-navy underline decoration-blue/50 underline-offset-4 hover:decoration-current">
              {accion} <ArrowRight size={16} className="shrink-0" aria-hidden />
            </Link>
          </header>
          {planes.map(({ nombre, enfoque, personas, equipo, incluye, funciones }, i) => (
            <article key={nombre} className="min-w-0 overflow-hidden rounded-md border border-line-soft bg-white sm:row-span-4 sm:grid sm:grid-rows-subgrid sm:gap-y-0">
              <div className={i === 0 ? 'bg-blue-100 px-5 py-4 sm:px-6' : 'bg-teal-100 px-5 py-4 sm:px-6'}>
                <h4 className="text-balance text-lg font-bold leading-snug text-navy">{nombre}</h4>
              </div>
              <p className="px-5 pt-4 text-sm leading-relaxed text-ink-2 sm:px-6">{enfoque}</p>
              <dl className="mx-5 my-4 grid grid-cols-2 gap-3 border-y border-line-soft py-3 text-sm sm:mx-6">
                <div>
                  <dt className="text-ink-2">Personas mayores</dt>
                  <dd className="mt-1 font-bold text-navy">{personas}</dd>
                </div>
                <div>
                  <dt className="text-ink-2">{limiteEquipo}</dt>
                  <dd className="mt-1 font-bold text-navy">{equipo}</dd>
                </div>
              </dl>
              <div className="px-5 pb-5 sm:px-6">
                <p className="text-sm font-bold text-navy">{incluye}</p>
                <ul className="mt-3 space-y-2 text-sm leading-normal text-ink-2">
                  {funciones.map((funcion) => (
                    <li key={funcion} className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 shrink-0 text-navy" aria-hidden /> {funcion}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
