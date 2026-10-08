import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, SelectField, SuccessOverlay, TextField } from '@/components/ui'
import { useUser } from '@/domain/auth'
import { todayISO } from '@/domain/dates'
import { mutate, uid, useDB } from '@/domain/store'
import type { Rol } from '@/domain/types'
import { Page, useShell } from '@/layouts/AppShell'
import { Nota } from '../components/Nota'
import { EMAIL_RE, passwordAleatoria, volver } from '../lib/datos'
import { rolTexto } from '../components/MiembroUi'
import styles from './AgregarMiembro.module.css'

type RolInvitado = 'cuidador' | 'coordinador'
interface Form {
  nombre: string
  apellido: string
  email: string
  rol: RolInvitado | ''
}
type Errores = Partial<Record<keyof Form, string>>

const NOMBRE_RE = /^\p{L}[\p{L}\s'.-]*$/u
const ROLES: Array<{ value: RolInvitado; label: string }> = [
  { value: 'cuidador', label: 'Cuidador' },
  { value: 'coordinador', label: 'Coordinador' },
]

export default function AgregarMiembro() {
  const { base } = useShell()
  const admin = useUser()
  const navigate = useNavigate()
  const usuarios = useDB((s) => s.usuarios)
  const invitaciones = useDB((s) => s.invitaciones)
  const [f, setF] = useState<Form>({ nombre: '', apellido: '', email: '', rol: '' })
  const [errores, setErrores] = useState<Errores>({})
  const [enviado, setEnviado] = useState(false)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((x) => ({ ...x, [k]: v }))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const validar = (): Errores => {
    const e: Errores = {}
    const nombre = f.nombre.trim()
    const apellido = f.apellido.trim()
    const email = f.email.trim().toLowerCase()
    if (!nombre) e.nombre = 'Ingresa el nombre.'
    else if (nombre.length < 2 || !NOMBRE_RE.test(nombre)) e.nombre = 'Ingresa un nombre válido.'
    if (!apellido) e.apellido = 'Ingresa el apellido.'
    else if (apellido.length < 2 || !NOMBRE_RE.test(apellido)) e.apellido = 'Ingresa un apellido válido.'
    if (!email) e.email = 'Ingresa el correo electrónico.'
    else if (!EMAIL_RE.test(email)) e.email = 'Ingresa un correo válido (ejemplo@correo.com).'
    else if (usuarios.some((u) => u.email.toLowerCase() === email)) e.email = 'Ya existe un usuario con este correo.'
    else if (invitaciones.some((i) => i.estado === 'pendiente' && i.email.toLowerCase() === email))
      e.email = 'Este correo ya tiene una invitación pendiente.'
    if (!f.rol) e.rol = 'Selecciona un rol.'
    return e
  }

  const enviar = (ev: FormEvent) => {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length > 0 || !f.rol) return
    const rol: Rol = f.rol
    const email = f.email.trim().toLowerCase()
    const nombre = f.nombre.trim()
    const apellido = f.apellido.trim()
    mutate((db) => {
      db.usuarios.push({
        id: uid('u'),
        rol,
        nombre,
        apellido,
        cedula: '',
        email,
        telefono: '',
        password: passwordAleatoria(),
        etiqueta: rolTexto(rol),
        estado: 'invitado',
        orgId: admin.orgId,
        familiaIds: [],
        creadoEn: todayISO(),
      })
      db.invitaciones.push({
        id: uid('inv'),
        familiaId: '',
        invitadoPor: admin.id,
        email,
        rol,
        nombre,
        apellido,
        estado: 'pendiente',
        creadaEn: new Date().toISOString(),
      })
    })
    setEnviado(true)
  }

  return (
    <Page title="Miembros" back={`${base}/miembros`}>
      <form className={styles.form} onSubmit={enviar} noValidate>
        <div className="stack-sm">
          <h2 className={styles.titulo}>Agregar Miembro</h2>
          <p className="muted">Ingresa la información básica para invitar al nuevo integrante a tu red de cuidado.</p>
        </div>

        <div className={styles.dos}>
          <TextField
            label="Nombre"
            placeholder="Nombre"
            autoComplete="off"
            value={f.nombre}
            error={errores.nombre}
            onChange={(e) => set('nombre', e.target.value)}
          />
          <TextField
            label="Apellido"
            placeholder="Apellido"
            autoComplete="off"
            value={f.apellido}
            error={errores.apellido}
            onChange={(e) => set('apellido', e.target.value)}
          />
        </div>
        <TextField
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="ejemplo@correo.com"
          value={f.email}
          error={errores.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <SelectField
          label="Rol"
          placeholder="Selecciona un rol"
          options={ROLES}
          value={f.rol}
          error={errores.rol}
          onChange={(e) => set('rol', e.target.value as RolInvitado)}
        />

        <Nota>Se enviará una invitación por correo para que el miembro cree su contraseña de acceso y configure su perfil.</Nota>

        <div className={styles.acciones}>
          <Button type="submit" fullWidth>
            Guardar y enviar invitación
          </Button>
          <Button variant="outline" fullWidth onClick={() => volver(navigate, `${base}/miembros`)}>
            Cancelar
          </Button>
        </div>
      </form>

      <SuccessOverlay
        open={enviado}
        message="Invitación enviada correctamente!"
        onDone={() => navigate(`${base}/miembros`, { replace: true })}
      />
    </Page>
  )
}
