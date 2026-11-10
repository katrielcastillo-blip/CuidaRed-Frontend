/*
 * VinculosSeccion.tsx — Vínculos usuario ↔ adulto mayor (tabla Vinculo: Env_Id, User_Id, Tipo_vinculo_Id).
 * Tres grupos gestionables, cada uno con el nombre y la descripción del catálogo Tipo_vinculo y la fecha del vínculo:
 *   Cuidadores asignados   (cuidador_asignado)    asignarCuidadores · permiso adultos:asignar
 *   Voluntarios asignados  (voluntario_asignado)  asignarVoluntarios · permiso adultos:asignar (no existen en cuentas Familia)
 *   Familiares autorizados (familiar_responsable) autorizarFamiliares · exige además familiares:autorizar; sin ese
 *                                                 permiso el grupo es de solo lectura.
 * Los vínculos definen quién puede ver el perfil (V2: el vínculo se combina con el rol). Otros tipos (p. ej.
 * referente) se listan sin edición.
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { Avatar, Button, Checkbox, EmptyState, HelpTip, Sheet, useToast } from '@/components/ui'
import { asignarCuidadores, asignarVoluntarios, autorizarFamiliares, type Resultado } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta } from '@/domain/dates'
import { puede, tipoCuentaDeUsuario } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto, TipoVinculo, Usuario } from '@/domain/types'
import { cuidadoresActivos, familiaresActivos, nombreCatalogo, voluntariosActivos } from '../../lib/datos'
import { NotaInfo, Seccion } from '../Piezas'

type Gestionable = Extract<TipoVinculo, 'cuidador_asignado' | 'voluntario_asignado' | 'familiar_responsable'>
const GRUPOS: Gestionable[] = ['cuidador_asignado', 'voluntario_asignado', 'familiar_responsable']

interface TextosGrupo {
  titulo: string
  tituloHoja: string
  vacio: string
  ayudaAsignar: string
  sinCandidatos: string
  quitado: string
}

const TEXTOS: Record<Gestionable, TextosGrupo> = {
  cuidador_asignado: {
    titulo: 'Cuidadores asignados',
    tituloHoja: 'Asignar cuidadores',
    vacio: 'Aún no tiene cuidadores asignados.',
    ayudaAsignar: 'podrán ver su perfil, registrar visitas, necesidades e indicaciones médicas, y cerrar alertas.',
    sinCandidatos: 'Invita o activa cuidadores desde Miembros.',
    quitado: 'ya no está asignado',
  },
  voluntario_asignado: {
    titulo: 'Voluntarios asignados',
    tituloHoja: 'Asignar voluntarios',
    vacio: 'Aún no tiene voluntarios asignados.',
    ayudaAsignar: 'podrán ver su perfil y registrar que la visita ocurrió con una observación (sin datos médicos).',
    sinCandidatos: 'Invita o activa voluntarios desde Miembros.',
    quitado: 'ya no está asignado',
  },
  familiar_responsable: {
    titulo: 'Familiares autorizados',
    tituloHoja: 'Familiares autorizados',
    vacio: 'Ningún familiar tiene autorización para ver este perfil.',
    ayudaAsignar: 'podrán consultar sus visitas, necesidades e indicaciones médicas (sin modificarlas).',
    sinCandidatos: 'Crea una cuenta con rol «Familiar» desde Miembros.',
    quitado: 'ya no tiene acceso',
  },
}

export function VinculosSeccion({ adulto, puedeAsignar, className }: { adulto: Adulto; puedeAsignar: boolean; className?: string }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const vinculos = useDB((s) => s.vinculos)
  const usuarios = useDB((s) => s.usuarios)
  const membresias = useDB((s) => s.membresias)
  const tipos = useDB((s) => s.catalogos.tiposVinculo)

  const propios = useMemo(() => vinculos.filter((v) => v.adultoId === adulto.id), [vinculos, adulto.id])
  const [editando, setEditando] = useState<Gestionable | null>(null)
  const [seleccion, setSeleccion] = useState<string[]>([])
  const cerrar = useCallback(() => setEditando(null), [])

  // Quién puede modificar cada grupo: asignar personal exige adultos:asignar; autorizar familiares, además familiares:autorizar.
  const puedeAutorizar = puedeAsignar && puede(user, 'familiares:autorizar')
  const gestiona = (tipo: Gestionable) => (tipo === 'familiar_responsable' ? puedeAutorizar : puedeAsignar)
  // Las cuentas Familia no tienen voluntarios (V2 §Cuenta): el grupo solo se muestra si ya hubiera alguno.
  const esFamilia = tipoCuentaDeUsuario(user) === 'familia'
  const visibles = GRUPOS.filter((t) => !(t === 'voluntario_asignado' && esFamilia && !propios.some((v) => v.tipoVinculoId === t)))

  const candidatos = useMemo(() => {
    if (editando === 'familiar_responsable') return familiaresActivos(usuarios, adulto.orgId, membresias)
    if (editando === 'cuidador_asignado') return cuidadoresActivos(usuarios, adulto.orgId, membresias)
    if (editando === 'voluntario_asignado') return voluntariosActivos(usuarios, adulto.orgId, membresias)
    return []
  }, [editando, usuarios, membresias, adulto.orgId])

  const idsDe = (tipo: string) => propios.filter((v) => v.tipoVinculoId === tipo).map((v) => v.usuarioId)

  const guardar = (tipo: Gestionable, ids: string[], mensaje: string) => {
    const servicio: Record<Gestionable, (actor: Usuario, adultoId: string, ids: string[]) => Resultado> = {
      cuidador_asignado: asignarCuidadores,
      voluntario_asignado: asignarVoluntarios,
      familiar_responsable: autorizarFamiliares,
    }
    const r = servicio[tipo](user, adulto.id, ids)
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
    const edita = gestiona(tipo)
    return (
      <div key={tipo} className="flex flex-col gap-2" data-testid={`vinculos-${tipo}`}>
        <div className="flex items-center justify-between gap-3 min-h-12">
          <h3 className="flex items-center gap-1 text-base font-bold text-navy">
            {TEXTOS[tipo].titulo} <span className="font-normal text-muted">({lista.length})</span>
            {cat?.descripcion && <HelpTip label={`Ayuda: ${TEXTOS[tipo].titulo}`}>{cat.descripcion} El vínculo define el acceso a los datos del adulto mayor.</HelpTip>}
          </h3>
          {edita && (
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
                    <small className="text-xs text-muted">{[u?.telefono, `Desde ${fechaCorta(v.creadoEn)}`, u && u.estado !== 'activo' ? 'Inactivo' : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                  {edita && (
                    <button
                      type="button"
                      className="size-12 grid place-items-center flex-none rounded-full text-danger hover:bg-danger-100 disabled:opacity-50"
                      aria-label={`Quitar a ${nombre}`}
                      disabled={!enLinea}
                      onClick={() =>
                        guardar(
                          tipo,
                          idsDe(tipo).filter((x) => x !== v.usuarioId),
                          `${nombre} ${TEXTOS[tipo].quitado}`,
                        )
                      }
                    >
                      <X size={20} aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {puedeAsignar && !edita && <p className="text-xs text-muted">Solo lectura: autorizar familiares requiere el permiso de quien administra la cuenta.</p>}
      </div>
    )
  }

  const otros = propios.filter((v) => !GRUPOS.includes(v.tipoVinculoId as Gestionable))

  return (
    <Seccion titulo="Vínculos" id="vinculos" className={className}>
      <div className="flex flex-col gap-4 p-4 rounded-md bg-surface shadow-1">
        {visibles.map((t, i) => (
          <div key={t} className="contents">
            {i > 0 && <hr className="border-line-soft" />}
            {grupo(t)}
          </div>
        ))}
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
        title={editando ? TEXTOS[editando].tituloHoja : undefined}
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
              Usuarios activos de tu cuenta. Marca los que se vincularán con {adulto.nombre}: {TEXTOS[editando].ayudaAsignar}
            </p>
            {!enLinea && <NotaInfo tono="aviso">Sin conexión: asignar vínculos necesita internet.</NotaInfo>}
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
