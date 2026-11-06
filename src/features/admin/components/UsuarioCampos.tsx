/*
 * UsuarioCampos.tsx — Campos del formulario de miembro: datos personales (tabla Usuario) y, en el alta, el rol de la
 * membresía (solo los roles del tipo de cuenta) y los adultos mayores a los que tendrá acceso (tabla Vinculo):
 * «familiar responsable» con permiso explícito, «cuidador asignado» o «voluntario asignado».
 * Módulo: admin (RF-09 · CU-13 pasos 2–3 · SRS §8.2.2.3.4 c · Reglas de Negocio V2 §Familiar y §Voluntario).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { TextField } from '@/components/ui'
import type { DatosUsuario } from '@/domain/api'
import { DESCRIPCION_ROL } from '@/domain/permisos'
import { tipoDeCuenta } from '@/domain/planes'
import type { Rol } from '@/domain/types'
import { ROL_LABEL, useSession } from '@/domain/auth'
import { ACCESO_POR_ROL } from '../lib/accesos'
import { alcanceDeRol, NOTA_ROL, rolesDeTipo } from '../lib/permisos'
import { Nota } from './Nota'
import { RolSelector } from './RolSelector'
import { SelectorAdultos } from './SelectorAdultos'

export type CamposUsuario = Omit<DatosUsuario, 'password'>
export type ErroresUsuario = Partial<Record<keyof DatosUsuario, string>>

export const CAMPOS_VACIOS: CamposUsuario = { nombre: '', apellido: '', email: '', telefono: '', cedula: '', rol: '', adultoIds: [] }

export function UsuarioCampos({
  datos,
  errores,
  onChange,
  modo = 'alta',
  bloqueado,
}: {
  datos: CamposUsuario
  errores: ErroresUsuario
  onChange: <K extends keyof CamposUsuario>(campo: K, valor: CamposUsuario[K]) => void
  /** «alta»: datos, rol y accesos. «datos»: solo los datos personales (el rol se cambia aparte). */
  modo?: 'alta' | 'datos'
  /** Motivo por el que los datos personales no se pueden editar (la persona los gestiona desde su propia cuenta). */
  bloqueado?: string
}) {
  const { org } = useSession()
  const tipo = tipoDeCuenta(org)
  const rol: Rol | '' = datos.rol
  const acceso = rol ? ACCESO_POR_ROL[rol] : undefined
  const soloLectura = !!bloqueado

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <TextField label="Nombre" required autoComplete="off" disabled={soloLectura} value={datos.nombre} error={errores.nombre} onChange={(e) => onChange('nombre', e.target.value)} />
        <TextField label="Apellido" required autoComplete="off" disabled={soloLectura} value={datos.apellido} error={errores.apellido} onChange={(e) => onChange('apellido', e.target.value)} />
        <TextField
          label="Correo electrónico"
          required
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="nombre@correo.com"
          disabled={soloLectura}
          value={datos.email}
          error={errores.email}
          help={
            modo === 'alta'
              ? 'Es el usuario con el que la persona inicia sesión. Si ya usa CuidaRed con este correo, se agrega a tu cuenta con su perfil actual: no necesita activar nada.'
              : 'Es el usuario con el que la persona inicia sesión. Debe ser único en CuidaRed.'
          }
          onChange={(e) => onChange('email', e.target.value)}
        />
        <TextField
          label="Teléfono"
          required
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="809 555 0100"
          disabled={soloLectura}
          value={datos.telefono}
          error={errores.telefono}
          onChange={(e) => onChange('telefono', e.target.value)}
        />
        <TextField
          label="Cédula (opcional)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000-0000000-0"
          disabled={soloLectura}
          value={datos.cedula}
          error={errores.cedula}
          hint="Formato 000-0000000-0."
          onChange={(e) => onChange('cedula', e.target.value)}
        />
      </div>
      {soloLectura && <Nota>{bloqueado}</Nota>}

      {modo === 'alta' && (
        <>
          <RolSelector valor={datos.rol} roles={rolesDeTipo(tipo)} error={errores.rol} onChange={(r) => onChange('rol', r)} />

          {rol && (
            <Nota>
              <strong className="block text-ink">{ROL_LABEL[rol]}</strong>
              {NOTA_ROL[rol] && rol === 'voluntario' && <strong className="block text-navy">{NOTA_ROL[rol]}</strong>}
              {DESCRIPCION_ROL[rol]}
              <span className="block mt-1">
                <strong>Alcance:</strong> {alcanceDeRol(rol, tipo)}
              </span>
            </Nota>
          )}

          {acceso && (
            <SelectorAdultos
              valor={datos.adultoIds}
              onChange={(ids) => onChange('adultoIds', ids)}
              titulo={acceso.titulo}
              error={errores.adultoIds}
              hint={acceso.pista}
              help={acceso.ayuda}
            />
          )}
          {rol === 'familiar' && datos.adultoIds.length === 0 && <Nota tono="warning">{NOTA_ROL.familiar}</Nota>}
          {rol === 'voluntario' && datos.adultoIds.length === 0 && (
            <Nota tono="warning">Sin adultos mayores asignados el voluntario no podrá registrar visitas. Puedes asignarlos ahora o después, desde su perfil.</Nota>
          )}
        </>
      )}
    </>
  )
}
