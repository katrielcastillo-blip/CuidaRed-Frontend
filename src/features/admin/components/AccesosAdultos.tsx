/*
 * AccesosAdultos.tsx — Sección del perfil de un miembro con los adultos mayores a los que tiene acceso: para el
 * Familiar, «Adultos mayores que puede ver» (permiso explícito, servicio autorizarFamiliares); para el Cuidador y el
 * Voluntario, sus adultos asignados (asignarCuidadores / asignarVoluntarios). Los servicios trabajan por adulto, así
 * que se aplica cada cambio sobre el adulto afectado. Quien no puede autorizar ve la lista en solo lectura.
 * Módulo: admin (RF-09 · CU-13 · Reglas de Negocio V2 §Familiar, §Vínculo y §Voluntario).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, UserRoundCheck } from 'lucide-react'
import { Button, RiesgoBadge, useToast } from '@/components/ui'
import { asignarCuidadores, asignarVoluntarios, autorizarFamiliares } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { puede } from '@/domain/permisos'
import { adultosVinculados, usuariosVinculados, VINCULO_DE_ROL } from '@/domain/relaciones'
import { getDB, useDB } from '@/domain/store'
import type { Rol, Usuario } from '@/domain/types'
import { useShell } from '@/layouts/AppShell'
import { ACCESO_POR_ROL } from '../lib/accesos'
import { AvisoSinConexion, Nota } from './Nota'
import { SelectorAdultos } from './SelectorAdultos'

const TARJETA = 'flex flex-col gap-3 p-4 rounded-md bg-surface shadow-1'

const SERVICIO = {
  familiar: autorizarFamiliares,
  cuidador: asignarCuidadores,
  voluntario: asignarVoluntarios,
} as const

const mismos = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

export function AccesosAdultos({ usuario, rol, className }: { usuario: Usuario; rol: Rol; className?: string }) {
  const yo = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const { base } = useShell()
  const adultos = useDB((s) => s.adultos)
  const vinculos = useDB((s) => s.vinculos)
  const acceso = ACCESO_POR_ROL[rol]
  const tipo = VINCULO_DE_ROL[rol]

  /** Adultos de ESTA cuenta con el vínculo del rol (los de otras cuentas del mismo usuario no se tocan). */
  const guardados = useMemo(() => {
    if (!tipo) return []
    const propios = new Set(adultos.filter((a) => a.orgId === yo.orgId).map((a) => a.id))
    return adultosVinculados(vinculos, usuario.id, tipo).filter((id) => propios.has(id))
  }, [adultos, vinculos, usuario.id, tipo, yo.orgId])

  /** Cambios sin guardar; `null` = se muestra lo guardado. */
  const [edicion, setEdicion] = useState<string[] | null>(null)
  const [guardando, setGuardando] = useState(false)
  const seleccion = edicion ?? guardados

  if (!acceso || !tipo) return null
  const puedeEditar = puede(yo, acceso.permiso)
  const hayCambios = edicion !== null && !mismos(edicion, guardados)

  const guardar = () => {
    if (edicion === null) return
    setGuardando(true)
    const servicio = SERVICIO[rol as keyof typeof SERVICIO]
    const afectados = [...new Set([...edicion.filter((id) => !guardados.includes(id)), ...guardados.filter((id) => !edicion.includes(id))])]
    let fallos = 0
    let primerError = ''
    for (const adultoId of afectados) {
      // Los servicios reemplazan el conjunto de usuarios vinculados a cada adulto: se parte del estado actual.
      const ids = usuariosVinculados(getDB().vinculos, adultoId, tipo)
      const nuevos = edicion.includes(adultoId) ? [...new Set([...ids, usuario.id])] : ids.filter((id) => id !== usuario.id)
      const r = servicio(yo, adultoId, nuevos)
      if (!r.ok) {
        fallos++
        primerError ||= r.error
      }
    }
    setGuardando(false)
    if (fallos > 0) {
      toast(fallos === afectados.length ? primerError : `${fallos} de ${afectados.length} cambios no se pudieron guardar. ${primerError}`, 'error')
      setEdicion(null)
      return
    }
    setEdicion(null)
    toast(rol === 'familiar' ? 'Autorizaciones guardadas' : 'Asignaciones guardadas')
  }

  return (
    <section className={`${TARJETA} ${className ?? ''}`} aria-labelledby="h-accesos-adultos">
      <h3 id="h-accesos-adultos" className="flex items-center gap-2 text-base font-bold">
        {rol === 'familiar' ? <Eye size={20} className="text-navy" aria-hidden /> : <UserRoundCheck size={20} className="text-navy" aria-hidden />}
        {acceso.titulo}
        <span className="ml-auto text-2xl font-bold" aria-label={`${guardados.length} adultos mayores`}>
          {guardados.length}
        </span>
      </h3>
      <p className="-mt-1 text-sm text-ink-2">{acceso.explicacion}</p>

      {puedeEditar ? (
        <>
          {!enLinea && <AvisoSinConexion />}
          <SelectorAdultos valor={seleccion} onChange={(ids) => setEdicion(ids)} titulo="Adultos mayores de la cuenta" hint="Los cambios se aplican al guardar." help={acceso.ayuda} deshabilitado={!enLinea} />
          {seleccion.length === 0 && <Nota tono="warning">{acceso.vacio}</Nota>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="sm" loading={guardando} disabled={!hayCambios || !enLinea} onClick={guardar}>
              {acceso.guardar}
            </Button>
            {hayCambios && (
              <Button size="sm" variant="light" onClick={() => setEdicion(null)}>
                Descartar cambios
              </Button>
            )}
          </div>
        </>
      ) : guardados.length === 0 ? (
        <p className="text-sm text-muted">{acceso.vacio}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {guardados.map((id) => {
            const a = adultos.find((x) => x.id === id)
            return a ? (
              <li key={id}>
                <Link to={`${base}/adultos/${a.id}`} className="flex items-center justify-between gap-3 min-h-14 py-1 hover:underline">
                  <span className="text-sm font-semibold truncate">{a.anonimizado ? 'Perfil anonimizado' : nombreCompleto(a)}</span>
                  <RiesgoBadge riesgo={a.riesgo} />
                </Link>
              </li>
            ) : null
          })}
        </ul>
      )}
    </section>
  )
}
