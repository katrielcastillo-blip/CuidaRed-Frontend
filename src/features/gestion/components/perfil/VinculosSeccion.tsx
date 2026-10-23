/*
 * VinculosSeccion.tsx — Vínculos usuario ↔ adulto mayor (tabla Vinculo: Env_Id, User_Id, Tipo_vinculo_Id).
 * Muestra los voluntarios asignados y los familiares responsables (que definen quién puede ver el perfil) con
 * el nombre y la descripción del catálogo Tipo_vinculo, la fecha del vínculo y, con permiso adultos:asignar,
 * permite asignar o quitar usuarios (asignarVinculos). Otros tipos (p. ej. referente) se listan sin edición.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { Avatar, Button, Checkbox, EmptyState, HelpTip, Sheet, useToast } from '@/components/ui'
import { asignarVinculos } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { Adulto, TipoVinculo, Usuario } from '@/domain/types'
import { familiaresActivos, nombreCatalogo, voluntariosActivos } from '../../lib/datos'
import { Seccion } from '../Piezas'

type Gestionable = Extract<TipoVinculo, 'voluntario_asignado' | 'familiar_responsable'>

const TEXTOS: Record<Gestionable, { vacio: string; ayudaAsignar: string; sinCandidatos: string; quitado: string }> = {
  voluntario_asignado: {
    vacio: 'Aún no tiene voluntarios asignados.',
    ayudaAsignar: 'podrán ver su perfil, registrar visitas y necesidades.',
    sinCandidatos: 'Invita o activa voluntarios desde Miembros.',
    quitado: 'ya no está asignado',
  },
  familiar_responsable: {
    vacio: 'Ningún familiar responsable tiene acceso a este perfil.',
    ayudaAsignar: 'podrán consultar sus visitas y necesidades (sin modificarlas).',
    sinCandidatos: 'Crea una cuenta con rol «Familiar responsable» desde Miembros.',
    quitado: 'ya no tiene acceso',
  },
}

export function VinculosSeccion({ adulto, puedeAsignar, className }: { adulto: Adulto; puedeAsignar: boolean; className?: string }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const vinculos = useDB((s) => s.vinculos)
  const usuarios = useDB((s) => s.usuarios)
  const tipos = useDB((s) => s.catalogos.tiposVinculo)

  const propios = useMemo(() => vinculos.filter((v) => v.adultoId === adulto.id), [vinculos, adulto.id])
  const [editando, setEditando] = useState<Gestionable | null>(null)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const cerrar = useCallback(() => setEditando(null), [])

  const candidatos = useMemo(
    () => (editando === 'familiar_responsable' ? familiaresActivos(usuarios, adulto.orgId) : editando ? voluntariosActivos(usuarios, adulto.orgId) : []),
    [editando, usuarios, adulto.orgId],
  )

  const idsDe = (tipo: string) => propios.filter((v) => v.tipoVinculoId === tipo).map((v) => v.usuarioId)

  const guardar = (tipo: Gestionable, ids: string[], mensaje: string) => {
    const r = asignarVinculos(user, adulto.id, tipo, ids)
    if (!r.ok) return toast(r.error, 'error')
    setEditando(null)
    toast(mensaje)
  }

  const abrir = (tipo: Gestionable) => {
    setSeleccion(idsDe(tipo))
    setEditando(tipo)
  }

  const grupo = (tipo: Gestionable) => {
    const cat = tipos.find((t) => t.id === tipo)
    const lista = propios.filter((v) => v.tipoVinculoId === tipo)
    return (
      <div key={tipo} className="flex flex-col gap-2" data-testid={`vinculos-${tipo}`}>
        <div className="flex items-center justify-between gap-3 min-h-12">
          <h3 className="flex items-center gap-1 text-base font-bold text-navy">
            {cat?.nombre ?? tipo} <span className="font-normal text-muted">({lista.length})</span>
            {cat?.descripcion && <HelpTip label={`Ayuda: ${cat.nombre}`}>{cat.descripcion} El vínculo define el acceso a los datos del adulto mayor.</HelpTip>}
          </h3>
          {puedeAsignar && (
            <Button size="sm" variant="light" icon={<UserPlus size={18} aria-hidden />} onClick={() => abrir(tipo)} disabled={!enLinea}>
              Asignar
            </Button>
          )}
        </div>
        {lista.length === 0 ? (
          <p className="text-sm text-muted">{TEXTOS[tipo].vacio}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((v) => {
              const u = usuarios.find((x) => x.id === v.usuarioId)
              const nombre = u ? nombreCompleto(u) : 'Usuario eliminado'
              return (
                <li key={v.usuarioId} className="flex items-center gap-3 px-3 py-2 rounded-sm border border-line-soft bg-surface">
                  <Avatar nombre={nombre} src={u?.avatar} size={40} />
                  <span className="flex flex-col flex-1 min-w-0 leading-tight">
                    <strong className="wrap-anywhere">{nombre}</strong>
                    <small className="text-xs text-muted">
                      {[u?.telefono, `Desde ${fechaCorta(v.creadoEn)}`, u && u.estado !== 'activo' ? 'Inactivo' : ''].filter(Boolean).join(' · ')}
                    </small>
                  </span>
                  {puedeAsignar && (
                    <button
                      type="button"
                      className="size-12 grid place-items-center flex-none rounded-full text-danger hover:bg-danger-100 disabled:opacity-50"
                      aria-label={`Quitar a ${nombre}`}
                      disabled={!enLinea}
                      onClick={() => guardar(tipo, idsDe(tipo).filter((x) => x !== v.usuarioId), `${nombre} ${TEXTOS[tipo].quitado}`)}
                    >
                      <X size={20} aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  const otros = propios.filter((v) => v.tipoVinculoId !== 'voluntario_asignado' && v.tipoVinculoId !== 'familiar_responsable')

  return (
    <Seccion titulo="Vínculos" id="vinculos" className={className}>
      <div className="flex flex-col gap-4 p-4 rounded-md bg-surface shadow-1">
        {grupo('voluntario_asignado')}
        <hr className="border-line-soft" />
        {grupo('familiar_responsable')}
        {otros.length > 0 && (
          <>
            <hr className="border-line-soft" />
            <ul className="flex flex-col gap-1 text-sm">
              {otros.map((v) => {
                const u = usuarios.find((x) => x.id === v.usuarioId)
                return (
                  <li key={v.usuarioId}>
                    <b>{nombreCatalogo(tipos, v.tipoVinculoId)}:</b> {u ? nombreCompleto(u) : 'Usuario eliminado'} · desde {fechaCorta(v.creadoEn)}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <Sheet
        open={!!editando}
        onClose={cerrar}
        title={editando === 'familiar_responsable' ? 'Familiares responsables' : 'Asignar voluntarios'}
        footer={
          editando && (
            <>
              <Button variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button disabled={!enLinea} onClick={() => guardar(editando, seleccion, 'Vínculos actualizados')}>
                Guardar
              </Button>
            </>
          )
        }
      >
        {editando && (
          <>
            <p className="text-sm text-muted">
              Usuarios activos de tu organización. Marca los que se vincularán con {adulto.nombre}: {TEXTOS[editando].ayudaAsignar}
            </p>
            {candidatos.length === 0 ? (
              <EmptyState title="No hay usuarios disponibles" text={TEXTOS[editando].sinCandidatos} />
            ) : (
              <ul className="flex flex-col">
                {candidatos.map((c: Usuario) => (
                  <li key={c.id} className="py-1 border-b border-surface-2">
                    <Checkbox
                      checked={seleccion.includes(c.id)}
                      onChange={(e) => setSeleccion((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                      label={
                        <span className="flex items-center gap-3">
                          <Avatar nombre={nombreCompleto(c)} src={c.avatar} size={36} />
                          <span className="flex flex-col min-w-0 leading-tight">
                            <strong className="text-base text-ink">{nombreCompleto(c)}</strong>
                            <small className="text-xs text-muted wrap-anywhere">{c.email}</small>
                          </span>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Sheet>
    </Seccion>
  )
}
