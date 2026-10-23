/*
 * Roles.tsx — Roles y permisos: descripción de los 4 roles y matriz de permisos legible (✓/—) generada desde
 * MATRIZ (domain/permisos.ts), con las reglas de alcance y privacidad de cada rol.
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.3.4 b/c · §8.2.2.3.5 c/d).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Fragment } from 'react'
import { Check, Minus, ShieldCheck } from 'lucide-react'
import { ROL_LABEL } from '@/domain/auth'
import { DESCRIPCION_ROL, MATRIZ } from '@/domain/permisos'
import type { Rol } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { RolBadge } from '../components/MiembroUi'
import { Nota } from '../components/Nota'
import { ALCANCE_ROL, matrizPorGrupo, ORDEN_ROLES } from '../lib/permisos'

const CORTO: Record<Rol, string> = { admin: 'Admin.', coordinador: 'Coord.', voluntario: 'Volunt.', familiar: 'Familiar' }

export default function Roles() {
  const { base } = useShell()
  const grupos = matrizPorGrupo()

  return (
    <Page title="Roles y permisos" back={`${base}/mas`} wide>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Roles y permisos</h2>
        <p className="text-muted">
          Cada persona accede solo a las funciones y datos de su rol (principio de mínimo privilegio). Los permisos se comprueban en la interfaz y otra vez al guardar cada operación.
        </p>
      </header>

      {/* Descripción de los roles */}
      <section aria-labelledby="h-roles" className="flex flex-col gap-3">
        <h2 id="h-roles" className="text-xl font-bold">
          Los 4 roles
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {ORDEN_ROLES.map((rol) => (
            <li key={rol} className="flex flex-col gap-2 p-4 rounded-md bg-surface shadow-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RolBadge rol={rol} grande />
                <span className="text-xs font-semibold text-muted whitespace-nowrap">{MATRIZ[rol].length} permisos</span>
              </div>
              <p className="text-sm text-ink">{DESCRIPCION_ROL[rol]}</p>
              <p className="text-sm text-ink-2">
                <strong>Alcance:</strong> {ALCANCE_ROL[rol]}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Nota>
        <strong className="block text-ink">Privacidad de los datos</strong>
        El <strong>Familiar responsable</strong> solo consulta a los adultos mayores con los que tiene vínculo «familiar responsable»: no ve otros adultos ni usuarios internos, y
        no modifica registros. El <strong>Voluntario</strong> solo ve y registra información de los adultos mayores que tiene asignados.
      </Nota>

      {/* Matriz */}
      <section aria-labelledby="h-matriz" className="flex flex-col gap-3">
        <h2 id="h-matriz" className="text-xl font-bold">
          Matriz de permisos
        </h2>
        <div className="relative overflow-x-auto rounded-md bg-surface shadow-1">
          <table className="w-full min-w-[340px] border-collapse text-sm">
            <caption className="sr-only">Permisos por rol: ✓ permitido, — no permitido</caption>
            <thead>
              <tr className="bg-navy text-white">
                <th scope="col" className="sticky left-0 z-[1] bg-navy text-left font-semibold px-3 py-3">
                  Función
                </th>
                {ORDEN_ROLES.map((rol) => (
                  <th key={rol} scope="col" className="px-1 py-3 font-semibold text-center w-[16%] md:w-[13%]">
                    <abbr title={ROL_LABEL[rol]} className="no-underline md:hidden">
                      {CORTO[rol]}
                    </abbr>
                    <span className="hidden md:inline">{ROL_LABEL[rol]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <Fragment key={g.grupo}>
                  <tr className="bg-blue-100">
                    <th scope="colgroup" colSpan={5} className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">
                      {g.grupo}
                    </th>
                  </tr>
                  {g.filas.map((f) => (
                    <tr key={f.accion} className="border-t border-line-soft">
                      <th scope="row" className="sticky left-0 bg-surface text-left font-normal px-3 py-2.5 text-ink">
                        {f.texto}
                      </th>
                      {ORDEN_ROLES.map((rol) => (
                        <td key={rol} className="text-center px-1 py-2.5">
                          {f.roles[rol] ? (
                            <span className="inline-grid place-items-center size-7 rounded-full bg-teal-100 text-success-700">
                              <Check size={16} strokeWidth={3} aria-hidden />
                              <span className="sr-only">Permitido para {ROL_LABEL[rol]}</span>
                            </span>
                          ) : (
                            <span className="inline-grid place-items-center size-7 text-muted">
                              <Minus size={16} aria-hidden />
                              <span className="sr-only">No permitido para {ROL_LABEL[rol]}</span>
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck size={18} className="flex-none mt-0.5 text-success-700" aria-hidden />
          Esta tabla se genera de la misma matriz que usa el sistema para autorizar cada operación. Para cambiar el rol de una persona, abre su perfil en Usuarios.
        </p>
      </section>
    </Page>
  )
}
