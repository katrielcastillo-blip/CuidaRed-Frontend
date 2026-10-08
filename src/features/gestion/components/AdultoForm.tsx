import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Button, ChoicePills, SelectField, TextField } from '@/components/ui'
import { todayISO } from '@/domain/dates'
import { useDB } from '@/domain/store'
import { FORM_VACIO, type AdultoFormValues } from '../lib/adultos'
import { cedulaValida, maskCedula, maskTelefono, telefonoValido } from '../lib/formato'
import { zonasDisponibles } from '../lib/zonas'
import { NotaInfo } from './Piezas'
import styles from './AdultoForm.module.css'

type Errores = Partial<Record<keyof AdultoFormValues, string>>

function validar(v: AdultoFormValues, cedulasUsadas: Set<string>): Errores {
  const e: Errores = {}
  if (v.nombre.trim().length < 2) e.nombre = 'Ingresa el nombre.'
  if (v.apellido.trim().length < 2) e.apellido = 'Ingresa el apellido.'
  if (!cedulaValida(v.cedula)) e.cedula = 'Ingresa una cédula válida (000-0000000-0).'
  else if (cedulasUsadas.has(v.cedula)) e.cedula = 'Ya hay un adulto registrado con esta cédula.'
  if (!v.fechaNacimiento) e.fechaNacimiento = 'Selecciona la fecha de nacimiento.'
  else {
    const n = new Date(`${v.fechaNacimiento}T00:00:00`)
    if (Number.isNaN(n.getTime()) || n.getFullYear() < 1900) e.fechaNacimiento = 'Revisa la fecha de nacimiento.'
    else if (v.fechaNacimiento > todayISO()) e.fechaNacimiento = 'La fecha de nacimiento no puede ser futura.'
  }
  if (!telefonoValido(v.telefono)) e.telefono = 'Ingresa un teléfono de 10 dígitos.'
  if (!v.sexo) e.sexo = 'Selecciona el sexo.'
  if (!v.zona) e.zona = 'Selecciona la zona o municipio.'
  if (v.contactoNombre.trim().length < 2) e.contactoNombre = 'Ingresa el nombre del contacto.'
  if (!telefonoValido(v.contactoTelefono)) e.contactoTelefono = 'Ingresa un teléfono de 10 dígitos.'
  return e
}

/** Campo con el lápiz de edición del Figma («Editar Adulto Mayor»). */
function ConLapiz({ activo, children }: { activo?: boolean; children: ReactNode }) {
  if (!activo) return <>{children}</>
  return (
    <div className={styles.lapiz}>
      {children}
      <Pencil size={18} className={styles.lapizIcono} aria-hidden />
    </div>
  )
}

/**
 * Formulario compartido de «Agregar Adulto Mayor» y «Editar Adulto Mayor».
 * Valida (cédula con máscara, teléfonos de 10 dígitos, fecha, requeridos) antes de llamar a `onSubmit`.
 */
export function AdultoForm({
  titulo,
  intro,
  inicial = FORM_VACIO,
  editando,
  idActual,
  enviarTexto,
  onSubmit,
  onCancel,
  extra,
}: {
  titulo: string
  intro?: string
  inicial?: AdultoFormValues
  editando?: boolean
  /** Adulto que se edita (se excluye de la comprobación de cédula duplicada). */
  idActual?: string
  enviarTexto: string
  onSubmit: (v: AdultoFormValues) => void
  onCancel: () => void
  extra?: ReactNode
}) {
  const adultos = useDB((s) => s.adultos)
  const [v, setV] = useState<AdultoFormValues>(inicial)
  const [intentado, setIntentado] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const cedulasUsadas = useMemo(() => new Set(adultos.filter((a) => a.id !== idActual).map((a) => a.cedula)), [adultos, idActual])
  const zonas = useMemo(() => {
    const actual = inicial.zona ? { zona: inicial.zona, municipio: '' } : undefined
    return zonasDisponibles(adultos, actual)
  }, [adultos, inicial.zona])
  const errores = useMemo(() => validar(v, cedulasUsadas), [v, cedulasUsadas])
  const ver = (campo: keyof AdultoFormValues) => (intentado ? errores[campo] : undefined)

  const set = <K extends keyof AdultoFormValues>(campo: K, valor: AdultoFormValues[K]) => setV((x) => ({ ...x, [campo]: valor }))

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    setIntentado(true)
    if (Object.keys(errores).length > 0) {
      // Lleva el foco al primer campo con error.
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error="true"] [role="radio"]')?.focus())
      return
    }
    onSubmit({ ...v, nombre: v.nombre.trim(), apellido: v.apellido.trim() })
  }

  const tel = (campo: 'telefono' | 'contactoTelefono', label: string) => (
    <ConLapiz activo={editando}>
      <TextField
        label={label}
        aria-required="true"
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000 000 0000"
        value={v[campo]}
        onChange={(e) => set(campo, maskTelefono(e.target.value))}
        error={ver(campo)}
      />
    </ConLapiz>
  )

  return (
    <form ref={formRef} className={styles.form} onSubmit={enviar} noValidate>
      <div className={styles.intro}>
        <h2>{titulo}</h2>
        {intro && <p>{intro}</p>}
      </div>

      <div className={styles.grid2}>
        <ConLapiz activo={editando}>
          <TextField label="Nombre" aria-required="true" placeholder="Nombre" autoComplete="off" value={v.nombre} onChange={(e) => set('nombre', e.target.value)} error={ver('nombre')} />
        </ConLapiz>
        <ConLapiz activo={editando}>
          <TextField label="Apellido" aria-required="true" placeholder="Apellido" autoComplete="off" value={v.apellido} onChange={(e) => set('apellido', e.target.value)} error={ver('apellido')} />
        </ConLapiz>
        <ConLapiz activo={editando}>
          <TextField
            label="Cédula"
            aria-required="true"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000-0000000-0"
            value={v.cedula}
            onChange={(e) => set('cedula', maskCedula(e.target.value))}
            error={ver('cedula')}
          />
        </ConLapiz>
        <TextField
          label="Fecha de Nacimiento"
          aria-required="true"
          type="date"
          max={todayISO()}
          value={v.fechaNacimiento}
          onChange={(e) => set('fechaNacimiento', e.target.value)}
          error={ver('fechaNacimiento')}
        />
        {tel('telefono', 'Teléfono')}
        <div data-error={ver('sexo') ? 'true' : undefined} className={styles.sexo}>
          <ChoicePills
            label="Sexo"
            value={v.sexo}
            onChange={(s) => set('sexo', s)}
            options={[
              { value: 'Femenino', label: 'Femenino' },
              { value: 'Masculino', label: 'Masculino' },
            ]}
          />
          {ver('sexo') && (
            <p className={styles.error} role="alert">
              {ver('sexo')}
            </p>
          )}
        </div>
        <div className={styles.completo}>
          <SelectField
            label="Zona/Municipio"
            aria-required="true"
            placeholder="Seleccionar"
            value={v.zona}
            onChange={(e) => set('zona', e.target.value)}
            error={ver('zona')}
            options={zonas.map((z) => ({ value: z.zona, label: z.municipio ? `${z.zona} · ${z.municipio}` : z.zona }))}
          />
        </div>
      </div>

      <h3 className={styles.subtitulo}>Contacto de Emergencia</h3>
      <div className={styles.grid2}>
        <ConLapiz activo={editando}>
          <TextField
            label="Nombre del Contacto"
            aria-required="true"
            placeholder="Nombre"
            autoComplete="off"
            value={v.contactoNombre}
            onChange={(e) => set('contactoNombre', e.target.value)}
            error={ver('contactoNombre')}
          />
        </ConLapiz>
        {tel('contactoTelefono', 'Teléfono de Emergencia')}
      </div>

      <NotaInfo>El nivel de riesgo se calculará automáticamente después de completar la evaluación inicial.</NotaInfo>

      <div className={styles.acciones}>
        <Button type="submit" fullWidth>
          {enviarTexto}
        </Button>
        <div className={styles.cancelar}>
          <Button variant="light" fullWidth onClick={onCancel}>
            Cancelar
          </Button>
        </div>
        {extra}
      </div>
    </form>
  )
}

