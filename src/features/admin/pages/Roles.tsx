/*
 * Roles.tsx — Roles y permisos de la cuenta: descripción de los roles que admite su tipo (Organización: Administrador,
 * Coordinador, Cuidador, Voluntario y Familiar responsable; Familia: Coordinador, Cuidador y Familiar) y matriz de
 * permisos legible (✓/—) generada de los permisos efectivos (MATRIZ + ajustes por tipo de cuenta, domain/permisos.ts),
 * con las reglas de alcance y privacidad de cada rol.
 * Módulo: admin (RF-09 · CU-13 · SRS §8.2.2.3.4 b/c · §8.2.2.3.5 c/d · Reglas de Negocio V2 §Cuenta).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { Fragment, useMemo } from 'react'
import { Check, Minus, ShieldCheck } from 'lucide-react'
import { ROL_LABEL, useSession } from '@/domain/auth'
import { DESCRIPCION_ROL, permisosDe } from '@/domain/permisos'
import { tipoDeCuenta, TIPO_CUENTA_LABEL } from '@/domain/planes'
import type { Rol } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { RolBadge } from '../components/MiembroUi'
import { Nota } from '../components/Nota'
import { alcanceDeRol, matrizPorGrupo, NOTA_ROL, rolesDeTipo } from '../lib/permisos'

const CORTO: Record<Rol, string> = { admin: 'Admin.', coordinador: 'Coord.', cuidador: 'Cuidador', voluntario: 'Volunt.', familiar: 'Familiar' }

export default function Roles() {
  const { base } = useShell()
  const { org } = useSession()
  const tipo = tipoDeCuenta(org)
  const roles = useMemo(() => rolesDeTipo(tipo), [tipo])
  const grupos = useMemo(() => matrizPorGrupo(tipo), [tipo])

  return (
    <Page title="Roles y permisos" back={`${base}/mas`} wide>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Roles y permisos</h2>
        <p className="text-muted">
          Cada persona accede solo a las funciones y datos de su rol (principio de mínimo privilegio). Los permisos se comprueban en la interfaz y otra vez al guardar cada operación.
        </p>
        <p className="text-sm text-ink-2">
          {tipo === 'familia'
            ? `Una cuenta ${TIPO_CUENTA_LABEL.familia} admite ${roles.length} roles. No hay Administrador: el Coordinador gestiona los miembros y autoriza a los familiares.`
            : `Una cuenta ${TIPO_CUENTA_LABEL.organizacion} admite ${roles.length} roles. El Administrador gestiona los miembros y autoriza a los familiares.`}
        </p>
      </header>

      {/* Descripción de los roles */}
      <section aria-labelledby="h-roles" className="flex flex-col gap-3">
        <h2 id="h-roles" className="text-xl font-bold">
          Los {roles.length} roles de la cuenta
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((rol) => (
            <li key={rol} className="flex flex-col gap-2 p-4 rounded-md bg-surface shadow-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RolBadge rol={rol} grande />
                <span className="text-xs font-semibold text-muted whitespace-nowrap">{permisosDe(rol, tipo).length} permisos</span>
              </div>
              <p className="text-sm text-ink">{DESCRIPCION_ROL[rol]}</p>
              <p className="text-sm text-ink-2">
                <strong>Alcance:</strong> {alcanceDeRol(rol, tipo)}
              </p>
              {rol === 'voluntario' && NOTA_ROL.voluntario && <p className="text-sm font-semibold text-navy">{NOTA_ROL.voluntario}</p>}
            </li>
          ))}
        </ul>
      </section>

      <Nota>
        <strong className="block text-ink">Privacidad de los datos</strong>
        El <strong>Familiar responsable</strong> solo consulta a los adultos mayores para los que tiene <strong>permiso explícito</strong> («familiar responsable»): sin autorización no ve
        ninguno, no ve a otros adultos ni a los demás miembros, y no modifica registros. El <strong>Cuidador</strong> y el <strong>Voluntario</strong> solo ven a los adultos mayores que
        tienen asignados; el voluntario ocasional registra visitas sin plan propio y sin acceso a información médica ni necesidades.
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
                {roles.map((rol) => (
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
                    <th scope="colgroup" colSpan={roles.length + 1} className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide text-navy">
                      {g.grupo}
                    </th>
                  </tr>
                  {g.filas.map((f) => (
                    <tr key={f.accion} className="border-t border-line-soft">
                      <th scope="row" className="sticky left-0 bg-surface text-left font-normal px-3 py-2.5 text-ink">
                        {f.texto}
                      </th>
                      {roles.map((rol) => (
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
          Esta tabla se genera de los mismos permisos que usa el sistema para autorizar cada operación en una cuenta {TIPO_CUENTA_LABEL[tipo]}. Para cambiar el rol de una persona,
          abre su perfil en Miembros.
        </p>
      </section>
    </Page>
  )
}
