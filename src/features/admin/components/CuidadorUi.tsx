/*
 * CuidadorUi.tsx — Perfil de cuidador de un usuario (tabla Cuidador: Tipo_cuidado_Id, Fecha_Inicio, Fecha_Fin,
 * Cuidador_Indep, user_empleador): ficha de solo lectura y hoja de edición que guarda con guardarCuidador.
 * Módulo: admin (CU-13 · modelo de datos V3.0 · agenda de cuidado).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { Button, ChoicePills, Datum, SelectField, Sheet, TextField, useToast } from '@/components/ui'
import { guardarCuidador, type DatosCuidador } from '@/domain/api'
import { nombreCompleto, useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { fechaCorta, todayISO } from '@/domain/dates'
import { nombreUsuario } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Cuidador, Usuario } from '@/domain/types'
import { rolTexto } from './MiembroUi'
import { AvisoSinConexion } from './Nota'

/** Ficha del perfil de cuidador (o aviso si no tiene). */
export function PerfilCuidador({ cuidador }: { cuidador?: Cuidador }) {
  const catalogos = useDB((s) => s.catalogos)
  const usuarios = useDB((s) => s.usuarios)
  if (!cuidador) {
    return <p className="text-sm text-muted">Sin perfil de cuidador. Regístralo si esta persona realiza tareas de cuidado (agenda de tareas, voluntariado o cuidado remunerado).</p>
  }
  const tipo = catalogos.tiposCuidado.find((t) => t.id === cuidador.tipoCuidadoId)?.nombre ?? cuidador.tipoCuidadoId
  const vigente = !cuidador.fechaFin || cuidador.fechaFin >= todayISO()
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Datum label="Tipo de cuidado" value={tipo} />
      <Datum label="Situación" value={vigente ? 'Vigente' : 'Finalizado'} />
      <Datum label="Fecha de inicio" value={fechaCorta(`${cuidador.fechaInicio}T12:00:00`)} />
      <Datum label="Fecha de fin" value={cuidador.fechaFin ? fechaCorta(`${cuidador.fechaFin}T12:00:00`) : 'Sin fecha de fin'} />
      <div className="col-span-2">
        <Datum label="Relación laboral" value={cuidador.independiente ? 'Independiente (por cuenta propia)' : `Empleado por ${nombreUsuario(usuarios, cuidador.empleadorUsuarioId)}`} />
      </div>
    </div>
  )
}

type Relacion = 'independiente' | 'empleado'
const RELACIONES: Array<{ value: Relacion; label: string }> = [
  { value: 'independiente', label: 'Independiente' },
  { value: 'empleado', label: 'Empleado por…' },
]

/** Hoja «Perfil de cuidador»: crea o actualiza el registro Cuidador del usuario. */
export function EditarCuidador({ usuario, cuidador, onClose }: { usuario: Usuario; cuidador?: Cuidador; onClose: () => void }) {
  const yo = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const usuarios = useDB((s) => s.usuarios)
  const [d, setD] = useState<DatosCuidador>({
    tipoCuidadoId: cuidador?.tipoCuidadoId ?? '',
    fechaInicio: cuidador?.fechaInicio ?? todayISO(),
    fechaFin: cuidador?.fechaFin ?? '',
    independiente: cuidador?.independiente ?? true,
    empleadorUsuarioId: cuidador?.empleadorUsuarioId ?? '',
  })
  const [errores, setErrores] = useState<Record<string, string | undefined>>({})

  const empleadores = useMemo(
    () =>
      usuarios
        .filter((u) => u.orgId === yo.orgId && u.id !== usuario.id && u.estado !== 'inactivo')
        .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)))
        .map((u) => ({ value: u.id, label: `${nombreCompleto(u)} · ${rolTexto(u.rol)}` })),
    [usuarios, yo.orgId, usuario.id],
  )

  const set = <K extends keyof DatosCuidador>(k: K, v: DatosCuidador[K]) => {
    setD((x) => ({ ...x, [k]: v }))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = () => {
    const r = guardarCuidador(yo, usuario.id, d)
    if (!r.ok) {
      setErrores(r.errores ?? {})
      toast(r.error, 'error')
      return
    }
    toast(cuidador ? 'Perfil de cuidador actualizado' : 'Perfil de cuidador registrado')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Perfil de cuidador · ${usuario.nombre}`}
      footer={
        <>
          <Button variant="light" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!enLinea}>
            Guardar
          </Button>
        </>
      }
    >
      {!enLinea && <AvisoSinConexion />}
      <SelectField
        label="Tipo de cuidado"
        required
        placeholder="Seleccionar"
        options={catalogos.tiposCuidado.map((t) => ({ value: t.id, label: t.nombre }))}
        value={d.tipoCuidadoId}
        error={errores.tipoCuidadoId}
        help="Voluntario comunitario, cuidador remunerado o familiar cuidador (catálogo Tipo de cuidado)."
        onChange={(e) => set('tipoCuidadoId', e.target.value)}
      />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <TextField label="Fecha de inicio" required type="date" value={d.fechaInicio} error={errores.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} />
        <TextField
          label="Fecha de fin (opcional)"
          type="date"
          min={d.fechaInicio || undefined}
          value={d.fechaFin}
          error={errores.fechaFin}
          hint="Déjala vacía si sigue cuidando."
          onChange={(e) => set('fechaFin', e.target.value)}
        />
      </div>
      <ChoicePills
        label="Relación laboral"
        value={d.independiente ? 'independiente' : 'empleado'}
        options={RELACIONES}
        help="Independiente: trabaja por cuenta propia o como voluntario. Si lo emplea otra persona (por ejemplo, un familiar responsable), indica quién."
        onChange={(v) => {
          set('independiente', v === 'independiente')
          if (v === 'independiente') set('empleadorUsuarioId', '')
        }}
      />
      {!d.independiente && (
        <SelectField
          label="Empleado por"
          required
          placeholder="Seleccionar usuario"
          options={empleadores}
          value={d.empleadorUsuarioId}
          error={errores.empleadorUsuarioId}
          onChange={(e) => set('empleadorUsuarioId', e.target.value)}
        />
      )}
    </Sheet>
  )
}
