/* Contacto externo al programar una visita; no crea una cuenta. © 2026 Equipo CuidaRed – INTEC. */
import { useState } from 'react'
import { Building2, UserRound, ArrowRight } from 'lucide-react'
import { Button, ChoicePills, SelectField, TextField, TextareaField } from '@/components/ui'
import { TIPOS_ENTIDAD_VISITANTE } from '@/features/auth/lib/solicitudVisita'

export type ContactoProgramado = {
  tipo: 'personal' | 'institucional'
  nombre: string
  correo: string
  telefono?: string
  entidad?: string
  tipo_entidad?: string
  cantidad: number
  aporte?: string
}

export function ContactoVisitante({
  valor,
  cambiar,
  continuar,
  disabled,
}: {
  valor: ContactoProgramado
  cambiar: (v: ContactoProgramado) => void
  continuar: () => void
  disabled: boolean
}) {
  const [error, setError] = useState('')
  const set = (campo: keyof ContactoProgramado, dato: string | number) => cambiar({ ...valor, [campo]: dato })
  return (
    <form
      className="grid gap-4 rounded-md border border-line-soft bg-surface p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        setError('')
        if (valor.nombre.trim().length < 3 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor.correo.trim())) {
          setError('Revisa el nombre del contacto y su correo.')
          return
        }
        continuar()
      }}
    >
      <header className="grid gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Paso 1 de 2 · Visitante</p>
        <h3 className="text-lg font-semibold text-navy">¿Quién realizará la visita?</h3>
        <p className="text-sm text-ink-2">
          Registra a la persona o al contacto del grupo. El visitante recibirá el horario y su código por correo, sin
          crear una cuenta.
        </p>
      </header>
      <fieldset disabled={disabled} className="grid min-w-0 gap-4">
        <ChoicePills
          label="Tipo de visitante"
          value={valor.tipo}
          onChange={(v) =>
            cambiar({
              nombre: valor.nombre,
              correo: valor.correo,
              telefono: valor.telefono,
              cantidad: valor.cantidad,
              tipo: v as ContactoProgramado['tipo'],
            })
          }
          options={[
            { value: 'personal', label: 'Persona o familiar' },
            { value: 'institucional', label: 'Institución o grupo' },
          ]}
        />
        <p className="flex items-center gap-2 text-sm text-ink-2">
          {valor.tipo === 'institucional' ? <Building2 size={18} aria-hidden /> : <UserRound size={18} aria-hidden />}
          {valor.tipo === 'institucional'
            ? 'El contacto representa al grupo visitante.'
            : 'El contacto realizará la visita personal.'}
        </p>
        {valor.tipo === 'institucional' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Tipo de institución o grupo"
              required
              placeholder="Selecciona un tipo"
              value={valor.tipo_entidad ?? ''}
              options={TIPOS_ENTIDAD_VISITANTE}
              onChange={(e) => set('tipo_entidad', e.target.value)}
            />
            <TextField
              label="Nombre de la institución o grupo"
              required
              minLength={2}
              maxLength={160}
              value={valor.entidad ?? ''}
              onChange={(e) => set('entidad', e.target.value)}
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={
              valor.tipo === 'institucional' ? 'Nombre del contacto responsable' : 'Nombre de quien realizará la visita'
            }
            required
            minLength={3}
            maxLength={120}
            value={valor.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
          <TextField
            label="Correo del visitante"
            type="email"
            required
            maxLength={254}
            value={valor.correo}
            onChange={(e) => set('correo', e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Teléfono de contacto (opcional)"
            type="tel"
            value={valor.telefono ?? ''}
            onChange={(e) => set('telefono', e.target.value.replace(/[^+0-9]/g, ''))}
            minLength={10}
            maxLength={16}
          />
          <TextField
            label="Cantidad de visitantes"
            type="number"
            required
            min={1}
            max={9999}
            value={valor.cantidad}
            onChange={(e) => set('cantidad', Number(e.target.value))}
          />
        </div>
        {valor.tipo === 'institucional' && (
          <TextareaField
            label="Actividad o aporte previsto (opcional)"
            rows={2}
            maxLength={300}
            value={valor.aporte ?? ''}
            onChange={(e) => set('aporte', e.target.value)}
          />
        )}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger-700">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={disabled} icon={<ArrowRight size={18} aria-hidden />}>
        Continuar con el horario
      </Button>
    </form>
  )
}
