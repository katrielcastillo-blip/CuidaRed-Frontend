/*
 * Fields.tsx — Campos de formulario: TextField, PasswordField, SelectField, TextareaField, SearchInput,
 * Checkbox, CheckboxGroup, Switch, ChoicePills. Todos con etiqueta, ayuda contextual y error accesible.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, Eye, EyeOff, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { HelpTip } from './Display'

interface FieldShellProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  /** Explicación desplegable junto a la etiqueta (ayuda en línea, SRS §8.2.2.1.8.2). */
  help?: ReactNode
  id: string
  children: ReactNode
}

const LABEL = 'text-base font-semibold text-ink'

function FieldShell({ label, required, error, hint, help, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {label && (
        <div className="flex items-center gap-1">
          <label htmlFor={id} className={LABEL}>
            {label}
            {required ? <span aria-hidden> *</span> : ''}
            {required && <span className="sr-only"> (obligatorio)</span>}
          </label>
          {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted text-sm" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type BaseProps = { label?: string; error?: string; hint?: string; help?: ReactNode }

/** Clase base de inputs: 52 px de alto, 16 px de letra (evita el zoom de iOS). */
export const INPUT =
  'w-full min-h-[52px] px-4 bg-bg border border-line rounded-sm text-base text-ink transition ' +
  'focus:outline-none focus:border-blue focus:ring-[3px] focus:ring-blue/25 disabled:bg-surface-2 disabled:text-muted'
const INVALIDO = 'border-danger'

const describedBy = (fid: string, error?: string, hint?: string) => (error ? `${fid}-err` : hint ? `${fid}-hint` : undefined)

export function TextField({ label, error, hint, help, required, id, className, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid}>
      <input
        id={fid}
        className={cn(INPUT, error && INVALIDO, className)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(fid, error, hint)}
        required={required}
        {...rest}
      />
    </FieldShell>
  )
}

export function PasswordField({ label, error, hint, help, required, id, ...rest }: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const auto = useId()
  const fid = id ?? auto
  const [show, setShow] = useState(false)
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid}>
      <div className="relative">
        <input
          id={fid}
          type={show ? 'text' : 'password'}
          className={cn(INPUT, 'pr-14', error && INVALIDO)}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(fid, error, hint)}
          required={required}
          {...rest}
        />
        <button
          type="button"
          className="absolute right-0.5 top-1/2 -translate-y-1/2 size-12 grid place-items-center text-ink rounded-sm"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <Eye size={22} /> : <EyeOff size={22} />}
        </button>
      </div>
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  help,
  required,
  id,
  placeholder,
  options,
  className,
  ...rest
}: BaseProps & {
  placeholder?: string
  options: Array<string | { value: string; label: string }>
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid}>
      <select
        id={fid}
        className={cn(INPUT, 'select-arrow', error && INVALIDO, className)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(fid, error, hint)}
        required={required}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => {
          const v = typeof o === 'string' ? { value: o, label: o } : o
          return (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          )
        })}
      </select>
    </FieldShell>
  )
}

export function TextareaField({ label, error, hint, help, required, id, className, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid}>
      <textarea
        id={fid}
        className={cn(INPUT, 'min-h-[120px] py-3 resize-y leading-snug', error && INVALIDO, className)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(fid, error, hint)}
        required={required}
        {...rest}
      />
    </FieldShell>
  )
}

export function SearchInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="search"
        className="w-full min-h-12 pl-4 pr-11 bg-surface border border-line rounded-3xl text-base focus:outline-none focus:border-blue focus:ring-[3px] focus:ring-blue/25"
        placeholder="Buscar..."
        aria-label="Buscar"
        {...rest}
      />
      <Search size={20} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
    </div>
  )
}

export function Checkbox({ label, id, className, ...rest }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <label
      htmlFor={fid}
      className={cn('flex items-center gap-3 min-h-12 text-sm text-ink-2 cursor-pointer [&_a]:text-navy [&_a]:font-semibold [&_a]:underline', className)}
    >
      <input id={fid} type="checkbox" className="size-6 m-0 accent-navy flex-none" {...rest} />
      <span>{label}</span>
    </label>
  )
}

/**
 * Grupo de casillas en rejilla de "fichas" de 48 px (checklists de visita, condiciones…).
 * Permite capturar datos sin texto libre (RF-06).
 */
export function CheckboxGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  hint,
  help,
  columns = 2,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T[]
  onChange: (v: T[]) => void
  error?: string
  hint?: string
  help?: ReactNode
  columns?: 1 | 2
}) {
  const id = useId()
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <fieldset className="flex flex-col gap-2 min-w-0 border-0 p-0 m-0" aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}>
      <legend className={cn(LABEL, 'flex items-center gap-1 mb-2')}>
        {label}
        {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
      </legend>
      <div className={cn('grid gap-2', columns === 2 && 'grid-cols-1 sm:grid-cols-2')}>
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <label
              key={o.value}
              className={cn(
                'flex items-center gap-3 min-h-12 px-3 rounded-sm border cursor-pointer text-sm font-semibold select-none',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-blue',
                on ? 'bg-blue-100 border-navy text-navy' : 'bg-bg border-line text-ink-2',
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(o.value)} />
              <span
                aria-hidden
                className={cn('grid place-items-center size-6 flex-none rounded-[5px] border-2', on ? 'bg-navy border-navy text-white' : 'border-line bg-white')}
              >
                {on && <Check size={16} strokeWidth={3} />}
              </span>
              <span>{o.label}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted text-sm" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </fieldset>
  )
}

/** Interruptor tipo toggle (Configurar organización, Evaluación de riesgo). Área táctil de 48 px. */
export function Switch({
  checked,
  onChange,
  label,
  id,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  id?: string
  disabled?: boolean
}) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className="flex items-center justify-between gap-4">
      {label && (
        <label htmlFor={fid} className="text-base text-ink">
          {label}
        </label>
      )}
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="grid place-items-center flex-none min-w-12 min-h-12 disabled:opacity-55"
        onClick={() => onChange(!checked)}
      >
        <span className={cn('relative block w-12 h-7 rounded-[14px] transition-colors', checked ? 'bg-blue' : 'bg-line-soft')}>
          <span
            className={cn(
              'absolute top-[3px] left-[3px] size-[22px] rounded-full bg-white shadow transition-transform',
              checked && 'translate-x-5',
            )}
          />
        </span>
      </button>
    </div>
  )
}

/** Selector de una opción entre pocas (botones tipo "píldora"): Activa/Inactiva, Femenino/Masculino… */
export function ChoicePills<T extends string>({
  value,
  onChange,
  options,
  label,
  error,
  help,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  label?: string
  error?: string
  help?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2 min-w-0" role="radiogroup" aria-label={label} aria-describedby={error ? `${id}-err` : undefined}>
      {label && (
        <span className={cn(LABEL, 'flex items-center gap-1')}>
          {label}
          {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={cn(
              'flex-1 basis-0 min-h-12 px-5 rounded-sm border font-semibold',
              value === o.value ? 'bg-navy text-white border-navy' : 'bg-bg text-ink-2',
              error ? 'border-danger' : value === o.value ? '' : 'border-line',
            )}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-danger text-sm" role="alert" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  )
}
