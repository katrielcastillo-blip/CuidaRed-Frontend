import { useId, useRef, useState, type InputHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Minus, Pencil, Plus } from 'lucide-react'
import { Button, IconTile, SelectField, Switch, useToast } from '@/components/ui'
import { useSession } from '@/domain/auth'
import { mutate } from '@/domain/store'
import type { Organizacion } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { Nota } from '../components/Nota'
import { telefonoValido, volver } from '../lib/datos'
import styles from './Configuracion.module.css'

const MIN_DIAS = 1
const MAX_DIAS = 90

const MUNICIPIOS = [
  'Santo Domingo',
  'Santo Domingo Este',
  'Santo Domingo Norte',
  'Santo Domingo Oeste',
  'Distrito Nacional',
  'Boca Chica',
  'Los Alcarrizos',
  'Pedro Brand',
  'San Antonio de Guerra',
  'San Cristóbal',
  'Santiago',
  'La Vega',
  'Puerto Plata',
  'San Pedro de Macorís',
  'La Romana',
  'Higüey',
]

export default function Configuracion() {
  const { base } = useShell()
  const { org } = useSession()
  return (
    <Page title="Configurar Organización" back={`${base}/mas`}>
      {org ? <Formulario key={org.id} org={org} /> : null}
    </Page>
  )
}

function Formulario({ org }: { org: Organizacion }) {
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()

  const [nombre, setNombre] = useState(org.nombre)
  const [telefono, setTelefono] = useState(org.telefono)
  const [municipio, setMunicipio] = useState(org.municipio)
  const [dias, setDias] = useState(org.config.diasSinVisitaAlerta)
  const [casos, setCasos] = useState(org.config.notificarCasosPrioritarios)
  const [voluntarios, setVoluntarios] = useState(org.config.notificarNuevosVoluntarios)
  const [errores, setErrores] = useState<{ nombre?: string; telefono?: string }>({})

  const municipios = MUNICIPIOS.includes(org.municipio) || !org.municipio ? MUNICIPIOS : [org.municipio, ...MUNICIPIOS]

  const guardar = () => {
    const n = nombre.trim()
    const t = telefono.trim()
    const e: typeof errores = {}
    if (!n) e.nombre = 'Ingresa el nombre de la organización.'
    else if (n.length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres.'
    if (!t) e.telefono = 'Ingresa el teléfono institucional.'
    else if (!telefonoValido(t)) e.telefono = 'Ingresa un teléfono válido de 10 dígitos (809 555 0100).'
    setErrores(e)
    if (e.nombre || e.telefono) {
      toast('Revisa los campos marcados.', 'error')
      return
    }
    mutate((db) => {
      const o = db.orgs.find((x) => x.id === org.id)
      if (!o) return
      o.nombre = n
      o.telefono = t
      o.municipio = municipio
      o.config.diasSinVisitaAlerta = dias
      o.config.notificarCasosPrioritarios = casos
      o.config.notificarNuevosVoluntarios = voluntarios
      o.config.contactoInstitucional = { nombre: n, telefono: t }
    })
    setNombre(n)
    setTelefono(t)
    toast('Cambios guardados correctamente')
  }

  return (
    <div className={styles.pantalla}>
      <div className={styles.cabecera}>
        <IconTile size={64}>
          <Building2 size={32} aria-hidden />
        </IconTile>
        <h2 className={styles.orgNombre}>{org.nombre}</h2>
      </div>

      {/* Datos de contacto institucional */}
      <section className={`${styles.tarjeta} ${styles.azul}`} aria-labelledby="h-contacto">
        <h3 id="h-contacto" className={styles.tarjetaTitulo}>
          Datos de Contacto Institucional
        </h3>
        <div className={styles.dos}>
          <CampoEditable
            label="Nombre de la organización"
            value={nombre}
            error={errores.nombre}
            autoComplete="organization"
            onChange={(v) => {
              setNombre(v)
              setErrores((x) => ({ ...x, nombre: undefined }))
            }}
          />
          <CampoEditable
            label="Teléfono institucional"
            value={telefono}
            error={errores.telefono}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            onChange={(v) => {
              setTelefono(v)
              setErrores((x) => ({ ...x, telefono: undefined }))
            }}
          />
        </div>
        <SelectField label="Municipio" value={municipio} options={municipios} onChange={(e) => setMunicipio(e.target.value)} />
      </section>

      {/* Umbrales de alerta */}
      <section className={`${styles.tarjeta} ${styles.blanca}`} aria-labelledby="h-umbrales">
        <h3 id="h-umbrales" className={styles.tarjetaTitulo}>
          Umbrales de Alerta
        </h3>
        <p className={styles.pregunta} id="lbl-dias">
          Días sin visita para generar alerta
        </p>
        <div className={styles.stepper} role="group" aria-labelledby="lbl-dias">
          <button
            type="button"
            className={styles.stepBtn}
            aria-label="Disminuir un día"
            disabled={dias <= MIN_DIAS}
            onClick={() => setDias((d) => Math.max(MIN_DIAS, d - 1))}
          >
            <Minus size={20} aria-hidden />
          </button>
          <output className={styles.dias} aria-live="polite">
            <strong>{dias}</strong>
            <span>{dias === 1 ? 'día' : 'días'}</span>
          </output>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label="Aumentar un día"
            disabled={dias >= MAX_DIAS}
            onClick={() => setDias((d) => Math.min(MAX_DIAS, d + 1))}
          >
            <Plus size={20} aria-hidden />
          </button>
        </div>
        <Nota>Si un adulto mayor no recibe visita durante este período, el sistema generará una alerta de seguimiento automáticamente.</Nota>
      </section>

      {/* Notificaciones */}
      <section className={`${styles.tarjeta} ${styles.azul}`} aria-labelledby="h-notif">
        <h3 id="h-notif" className={styles.tarjetaTitulo}>
          Notificaciones
        </h3>
        <Notificacion
          titulo="Recibir notificaciones de casos prioritarios"
          detalle="Casos marcados como prioritarios por el equipo"
          valor={casos}
          onChange={setCasos}
        />
        <Notificacion
          titulo="Recibir notificaciones de nuevas solicitudes de voluntarios"
          detalle="Avisos de postulaciones y nuevos cuidadores en la zona"
          valor={voluntarios}
          onChange={setVoluntarios}
        />
      </section>

      <div className={styles.acciones}>
        <Button fullWidth onClick={guardar}>
          Guardar cambios
        </Button>
        <Button variant="outline" fullWidth onClick={() => volver(navigate, `${base}/mas`)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/** Campo con lápiz: el icono enfoca y selecciona el texto para editarlo. */
function CampoEditable({
  label,
  value,
  onChange,
  error,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; error?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'id'
>) {
  const id = useId()
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className={styles.campo}>
      <label htmlFor={id} className={styles.etiqueta}>
        {label}
      </label>
      <div className={`${styles.entrada} ${error ? styles.invalido : ''}`}>
        <input
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          {...rest}
        />
        <button
          type="button"
          className={styles.lapiz}
          aria-label={`Editar ${label.toLowerCase()}`}
          onClick={() => {
            ref.current?.focus()
            ref.current?.select()
          }}
        >
          <Pencil size={18} aria-hidden />
        </button>
      </div>
      {error && (
        <p className={styles.error} id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Notificacion({ titulo, detalle, valor, onChange }: { titulo: string; detalle: string; valor: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  return (
    <div className={styles.notif}>
      <div className={styles.notifTexto}>
        <label htmlFor={id} className={styles.notifTitulo}>
          {titulo}
        </label>
        <p className={styles.notifDetalle}>{detalle}</p>
      </div>
      <Switch id={id} checked={valor} onChange={onChange} />
    </div>
  )
}
