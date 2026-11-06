/*
 * Fields.tsx — Campos de formulario: TextField, PasswordField, SelectField, TextareaField, SearchInput,
 * Checkbox, CheckboxGroup, Switch, ChoicePills. Todos con etiqueta, ayuda contextual y error accesible
 * (aria-invalid + aria-describedby), objetivos táctiles de 48 px y letra de 16 px (RF-06).
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import {
  useId,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, CircleAlert, Eye, EyeOff, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAyudaAbreviaturas } from './Abreviaturas'
import { HelpTip } from './Display'

interface FieldShellProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  /** Explicación desplegable junto a la etiqueta (ayuda en línea, SRS §8.2.2.1.8.2). */
  help?: ReactNode
  id: string
  /** Acción al pie, a la derecha del mensaje de ayuda/error (p. ej. "Procesar abreviaturas"). */
  footer?: ReactNode
  children: ReactNode
}

const LABEL = 'text-base font-semibold text-ink'

/** Marca de campo obligatorio: asterisco visible + "(obligatorio)" para lectores de pantalla. */
const Obligatorio = () => (
  <>
    <span aria-hidden> *</span>
    <span className="sr-only"> (obligatorio)</span>
  </>
)

/** Mensaje junto al campo: el error (role="alert", con icono para no depender solo del color) o la ayuda breve. */
function MensajeCampo({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p className="flex items-start gap-1.5 text-danger text-sm" role="alert" id={`${id}-err`}>
        <CircleAlert size={16} className="mt-0.5 flex-none" aria-hidden />
        <span>{error}</span>
      </p>
    )
  }
  if (hint) {
    return (
      <p className="text-muted text-sm" id={`${id}-hint`}>
        {hint}
      </p>
    )
  }
  return null
}

function FieldShell({ label, required, error, hint, help, id, footer, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      {label && (
        <div className="flex items-center gap-1">
          <label htmlFor={id} className={LABEL}>
            {label}
            {required && <Obligatorio />}
          </label>
          {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
        </div>
      )}
      {children}
      {footer ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0 grow">
            <MensajeCampo id={id} error={error} hint={hint} />
          </div>
          <div className="flex-none">{footer}</div>
        </div>
      ) : (
        <MensajeCampo id={id} error={error} hint={hint} />
      )}
    </div>
  )
}

type BaseProps = { label?: string; error?: string; hint?: string; help?: ReactNode }

/**
 * Ayuda de abreviaturas (CU-07) para campos de texto: expansión al escribir, sugerencias y botón
 * "Procesar abreviaturas". Funciona sin conexión. Solo para campos de texto (no number, date…).
 */
type PropsAbreviaturas = {
  abreviaturas?: boolean
  /** Con `abreviaturas`: muestra el botón "Procesar abreviaturas" (por defecto sí). */
  procesarAbreviaturas?: boolean
}

/** Clase base de inputs: 52 px de alto, 16 px de letra (evita el zoom de iOS). */
export const INPUT =
  'w-full min-h-[52px] px-4 bg-bg border border-line rounded-sm text-base text-ink transition ' +
  'focus:outline-none focus:border-blue focus:ring-[3px] focus:ring-blue/25 disabled:bg-surface-2 disabled:text-muted'
const INVALIDO = 'border-danger'

const describedBy = (fid: string, error?: string, hint?: string) => (error ? `${fid}-err` : hint ? `${fid}-hint` : undefined)

type PropsTexto = BaseProps & InputHTMLAttributes<HTMLInputElement>

function TextFieldBase({ label, error, hint, help, required, id, className, ...rest }: PropsTexto) {
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

function TextFieldAbreviado({
  label,
  error,
  hint,
  help,
  required,
  id,
  className,
  procesar = true,
  onChange,
  onKeyDown,
  onKeyUp,
  onClick,
  onFocus,
  onBlur,
  ...rest
}: PropsTexto & { procesar?: boolean }) {
  const auto = useId()
  const fid = id ?? auto
  const { ref, campoProps, lista, boton } = useAyudaAbreviaturas<HTMLInputElement>({
    maxLength: rest.maxLength,
    valor: rest.value,
    deshabilitado: rest.disabled || rest.readOnly,
    botonProcesar: procesar,
    manejadores: { onChange, onKeyDown, onKeyUp, onClick, onFocus, onBlur },
  })
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid} footer={boton}>
      <div className="relative">
        <input
          ref={ref}
          id={fid}
          className={cn(INPUT, error && INVALIDO, className)}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(fid, error, hint)}
          required={required}
          autoComplete="off"
          {...rest}
          {...campoProps}
        />
        {lista}
      </div>
    </FieldShell>
  )
}

export function TextField({ abreviaturas, procesarAbreviaturas, ...props }: PropsTexto & PropsAbreviaturas) {
  return abreviaturas ? <TextFieldAbreviado {...props} procesar={procesarAbreviaturas} /> : <TextFieldBase {...props} />
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

const AREA = 'min-h-[120px] py-3 resize-y leading-snug'

type PropsArea = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>

function TextareaFieldBase({ label, error, hint, help, required, id, className, ...rest }: PropsArea) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid}>
      <textarea
        id={fid}
        className={cn(INPUT, AREA, error && INVALIDO, className)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(fid, error, hint)}
        required={required}
        {...rest}
      />
    </FieldShell>
  )
}

function TextareaFieldAbreviado({
  label,
  error,
  hint,
  help,
  required,
  id,
  className,
  procesar = true,
  onChange,
  onKeyDown,
  onKeyUp,
  onClick,
  onFocus,
  onBlur,
  ...rest
}: PropsArea & { procesar?: boolean }) {
  const auto = useId()
  const fid = id ?? auto
  const { ref, campoProps, lista, boton } = useAyudaAbreviaturas<HTMLTextAreaElement>({
    maxLength: rest.maxLength,
    valor: rest.value,
    deshabilitado: rest.disabled || rest.readOnly,
    botonProcesar: procesar,
    manejadores: { onChange, onKeyDown, onKeyUp, onClick, onFocus, onBlur },
  })
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} help={help} id={fid} footer={boton}>
      <div className="relative">
        <textarea
          ref={ref}
          id={fid}
          className={cn(INPUT, AREA, error && INVALIDO, className)}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy(fid, error, hint)}
          required={required}
          autoComplete="off"
          {...rest}
          {...campoProps}
        />
        {lista}
      </div>
    </FieldShell>
  )
}

export function TextareaField({ abreviaturas, procesarAbreviaturas, ...props }: PropsArea & PropsAbreviaturas) {
  return abreviaturas ? <TextareaFieldAbreviado {...props} procesar={procesarAbreviaturas} /> : <TextareaFieldBase {...props} />
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

/** Casilla suelta (consentimientos, términos). Con `error` muestra el mensaje junto a ella y marca aria-invalid. */
export function Checkbox({
  label,
  id,
  className,
  error,
  hint,
  ...rest
}: { label: ReactNode; error?: string; hint?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const auto = useId()
  const fid = id ?? auto
  const casilla = (
    <label
      htmlFor={fid}
      className={cn('flex items-center gap-3 min-h-12 text-sm text-ink-2 cursor-pointer [&_a]:text-navy [&_a]:font-semibold [&_a]:underline', className)}
    >
      <input
        id={fid}
        type="checkbox"
        className="size-6 m-0 accent-navy flex-none"
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(fid, error, hint)}
        {...rest}
      />
      <span>{label}</span>
    </label>
  )
  if (!error && !hint) return casilla
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {casilla}
      <MensajeCampo id={fid} error={error} hint={hint} />
    </div>
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
  required,
  id,
  columns = 2,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T[]
  onChange: (v: T[]) => void
  error?: string
  hint?: string
  help?: ReactNode
  required?: boolean
  /** Identificador del grupo (lo usa `useFormulario` para llevar el foco al primer campo inválido). */
  id?: string
  columns?: 1 | 2
}) {
  const auto = useId()
  const gid = id ?? auto
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <fieldset id={gid} className="flex flex-col gap-2 min-w-0 border-0 p-0 m-0" aria-describedby={describedBy(gid, error, hint)}>
      <legend className={cn(LABEL, 'flex items-center gap-1 mb-2')}>
        <span>
          {label}
          {required && <Obligatorio />}
        </span>
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
                error && !on && 'border-danger',
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
      <MensajeCampo id={gid} error={error} hint={hint} />
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

/**
 * Selector de una opción entre pocas (botones tipo "píldora"): Activa/Inactiva, Femenino/Masculino…
 * Además del toque, se recorre con las flechas del teclado (patrón radiogroup).
 */
export function ChoicePills<T extends string>({
  value,
  onChange,
  options,
  label,
  error,
  hint,
  help,
  required,
  id,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  label?: string
  error?: string
  hint?: string
  help?: ReactNode
  required?: boolean
  /** Identificador del grupo (lo usa `useFormulario` para llevar el foco al primer campo inválido). */
  id?: string
}) {
  const auto = useId()
  const gid = id ?? auto
  const alTecla = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const siguiente = (i + delta + options.length) % options.length
    onChange(options[siguiente]!.value)
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[siguiente]?.focus()
  }
  return (
    <div
      id={gid}
      // tabIndex -1: el grupo puede recibir el foco por código (primer campo inválido) sin entrar en el orden de tabulación.
      tabIndex={-1}
      className="flex flex-col gap-2 min-w-0 outline-none"
      role="radiogroup"
      aria-label={label}
      aria-required={required || undefined}
      aria-invalid={!!error || undefined}
      aria-describedby={describedBy(gid, error, hint)}
    >
      {label && (
        <span className={cn(LABEL, 'flex items-center gap-1')}>
          <span>
            {label}
            {required && <Obligatorio />}
          </span>
          {help && <HelpTip label={`Ayuda: ${label}`}>{help}</HelpTip>}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
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
            onKeyDown={(e) => alTecla(e, i)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <MensajeCampo id={gid} error={error} hint={hint} />
    </div>
  )
}
