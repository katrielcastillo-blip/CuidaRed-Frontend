/*
 * UsuarioCampos.tsx — Campos del formulario de usuario (alta y edición, tabla Usuario): datos personales, rol
 * (Membresia.Rol_Id) con su descripción y alcance y, para el familiar responsable, los adultos mayores a su cargo
 * (vínculos «familiar_responsable» de la tabla Vinculo).
 * Módulo: admin (RF-09 · CU-13 pasos 2–3 · SRS §8.2.2.3.4 c).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useId, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { CheckboxGroup, HelpTip, SearchInput, TextField } from '@/components/ui'
import { nombreCompleto, useSession } from '@/domain/auth'
import type { DatosUsuario } from '@/domain/api'
import { ROLES } from '@/domain/catalogos'
import { DESCRIPCION_ROL } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import { nombreMunicipio } from '@/domain/relaciones'
import type { Rol } from '@/domain/types'
import { cn } from '@/lib/cn'
import { normalizar } from '../lib/datos'
import { ALCANCE_ROL } from '../lib/permisos'
import { Nota } from './Nota'

export type CamposUsuario = Omit<DatosUsuario, 'password'>
export type ErroresUsuario = Partial<Record<keyof DatosUsuario, string>>

export const CAMPOS_VACIOS: CamposUsuario = { nombre: '', apellido: '', email: '', telefono: '', cedula: '', rol: '', adultoIds: [] }

export function UsuarioCampos({
  datos,
  errores,
  onChange,
  bloquearRol,
}: {
  datos: CamposUsuario
  errores: ErroresUsuario
  onChange: <K extends keyof CamposUsuario>(campo: K, valor: CamposUsuario[K]) => void
  /** Motivo por el que no se puede cambiar el rol (p. ej. tu propia cuenta). */
  bloquearRol?: string
}) {
  const { org } = useSession()
  const adultos = useDB((s) => s.adultos)
  const catalogos = useDB((s) => s.catalogos)
  const [busqueda, setBusqueda] = useState('')

  /** Adultos mayores de la cuenta (los ya marcados siempre aparecen, aunque no coincidan con la búsqueda). */
  const opcionesAdultos = useMemo(() => {
    const q = normalizar(busqueda)
    return adultos
      .filter((a) => a.orgId === org?.id && !a.anonimizado && (a.estado === 'activo' || datos.adultoIds.includes(a.id)))
      .filter((a) => !q || datos.adultoIds.includes(a.id) || normalizar(`${nombreCompleto(a)} ${a.cedula} ${a.zona}`).includes(q))
      .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)))
      .map((a) => ({ value: a.id, label: `${nombreCompleto(a)} · ${[a.zona, nombreMunicipio(catalogos, a.municipioCod)].filter(Boolean).join(', ')}` }))
  }, [adultos, catalogos, org, busqueda, datos.adultoIds])

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2">
        <TextField label="Nombre" required autoComplete="off" value={datos.nombre} error={errores.nombre} onChange={(e) => onChange('nombre', e.target.value)} />
        <TextField label="Apellido" required autoComplete="off" value={datos.apellido} error={errores.apellido} onChange={(e) => onChange('apellido', e.target.value)} />
        <TextField
          label="Correo electrónico"
          required
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="nombre@correo.com"
          value={datos.email}
          error={errores.email}
          help="Es el usuario con el que la persona iniciará sesión. Debe ser único en CuidaRed."
          onChange={(e) => onChange('email', e.target.value)}
        />
        <TextField
          label="Teléfono"
          required
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="809 555 0100"
          value={datos.telefono}
          error={errores.telefono}
          onChange={(e) => onChange('telefono', e.target.value)}
        />
        <TextField
          label="Cédula (opcional)"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000-0000000-0"
          value={datos.cedula}
          error={errores.cedula}
          hint="Formato 000-0000000-0."
          onChange={(e) => onChange('cedula', e.target.value)}
        />
      </div>

      <RolSelector valor={datos.rol} error={errores.rol} onChange={(rol) => onChange('rol', rol)} bloqueado={bloquearRol} />

      {datos.rol && (
        <Nota>
          <strong className="block text-ink">{ROLES.find((r) => r.value === datos.rol)?.label}</strong>
          {DESCRIPCION_ROL[datos.rol]}
          <span className="block mt-1">
            <strong>Alcance:</strong> {ALCANCE_ROL[datos.rol]}
          </span>
        </Nota>
      )}

      {datos.rol === 'familiar' && (
        <div className="flex flex-col gap-3 min-w-0">
          <SearchInput
            aria-label="Buscar adulto mayor por nombre, cédula o sector"
            placeholder="Buscar adulto mayor…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <CheckboxGroup
            label={`Adultos mayores a su cargo * (${datos.adultoIds.length} seleccionado${datos.adultoIds.length === 1 ? '' : 's'})`}
            columns={1}
            options={opcionesAdultos}
            value={datos.adultoIds}
            error={errores.adultoIds}
            hint={opcionesAdultos.length === 0 ? 'No hay adultos mayores que coincidan con la búsqueda.' : 'Se creará un vínculo «Familiar responsable» con cada adulto marcado.'}
            help="Por privacidad, el familiar responsable solo puede consultar el seguimiento de los adultos mayores marcados aquí; no ve a otros adultos ni a los usuarios de la organización."
            onChange={(v) => onChange('adultoIds', v)}
          />
        </div>
      )}
    </>
  )
}

/** Selector de rol en tarjetas de 48 px (radio accesible). */
function RolSelector({ valor, onChange, error, bloqueado }: { valor: Rol | ''; onChange: (r: Rol) => void; error?: string; bloqueado?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <span className="flex items-center gap-1 text-base font-semibold text-ink" id={`${id}-l`}>
        Rol<span aria-hidden> *</span>
        <HelpTip label="Ayuda: Rol">
          El rol define a qué funciones y datos tendrá acceso la persona. Puedes cambiarlo después; el cambio se aplica de inmediato en todos los módulos.
        </HelpTip>
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-l`} aria-describedby={error ? `${id}-err` : bloqueado ? `${id}-b` : undefined} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {ROLES.map((r) => {
          const on = valor === r.value
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!!bloqueado && !on}
              onClick={() => onChange(r.value)}
              className={cn(
                'flex items-center gap-2 min-h-12 px-3 py-2 rounded-sm border text-left text-sm font-semibold leading-tight disabled:opacity-50 disabled:cursor-not-allowed',
                on ? 'bg-navy border-navy text-white' : 'bg-bg text-ink-2',
                error ? 'border-danger' : !on && 'border-line',
              )}
            >
              <span aria-hidden className={cn('grid place-items-center size-5 flex-none rounded-full border-2', on ? 'border-white bg-white text-navy' : 'border-line')}>
                {on && <Check size={12} strokeWidth={4} />}
              </span>
              {r.label}
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      ) : bloqueado ? (
        <p className="text-muted text-sm" id={`${id}-b`}>
          {bloqueado}
        </p>
      ) : null}
    </div>
  )
}
