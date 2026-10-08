import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Eye, EyeOff, Search } from 'lucide-react'
import styles from './Fields.module.css'

interface FieldShellProps {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  id: string
  children: ReactNode
}

function FieldShell({ label, required, error, hint, id, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      {children}
      {error ? (
        <p className={styles.error} role="alert" id={`${id}-err`}>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  )
}

type BaseProps = { label?: string; error?: string; hint?: string }

export function TextField({ label, error, hint, required, id, className, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={fid}>
      <input
        id={fid}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${fid}-err` : undefined}
        required={required}
        {...rest}
      />
    </FieldShell>
  )
}

export function PasswordField({ label, error, hint, required, id, ...rest }: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const auto = useId()
  const fid = id ?? auto
  const [show, setShow] = useState(false)
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={fid}>
      <div className={styles.passwordWrap}>
        <input
          id={fid}
          type={show ? 'text' : 'password'}
          className={`${styles.input} ${error ? styles.invalid : ''}`}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${fid}-err` : undefined}
          required={required}
          {...rest}
        />
        <button
          type="button"
          className={styles.eye}
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
  required,
  id,
  placeholder,
  options,
  ...rest
}: BaseProps & {
  placeholder?: string
  options: Array<string | { value: string; label: string }>
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={fid}>
      <select
        id={fid}
        className={`${styles.input} ${styles.select} ${error ? styles.invalid : ''}`}
        aria-invalid={!!error || undefined}
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

export function TextareaField({ label, error, hint, required, id, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <FieldShell label={label} required={required} error={error} hint={hint} id={fid}>
      <textarea
        id={fid}
        className={`${styles.input} ${styles.textarea} ${error ? styles.invalid : ''}`}
        aria-invalid={!!error || undefined}
        required={required}
        {...rest}
      />
    </FieldShell>
  )
}

export function SearchInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className={`${styles.search} ${className ?? ''}`}>
      <input type="search" className={styles.searchInput} placeholder="Buscar..." aria-label="Buscar" {...rest} />
      <Search size={20} className={styles.searchIcon} aria-hidden />
    </div>
  )
}

export function Checkbox({ label, id, ...rest }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <label htmlFor={fid} className={styles.check}>
      <input id={fid} type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  )
}

/** Interruptor tipo toggle (Configurar organización, Evaluación de riesgo). */
export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  id?: string
}) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <div className={styles.switchRow}>
      {label && (
        <label htmlFor={fid} className={styles.switchLabel}>
          {label}
        </label>
      )}
      <button
        id={fid}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.switch} ${checked ? styles.switchOn : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.knob} />
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
}: {
  value: T | ''
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  label?: string
}) {
  return (
    <div className={styles.field} role="radiogroup" aria-label={label}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.pills}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`${styles.pill} ${value === o.value ? styles.pillOn : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
