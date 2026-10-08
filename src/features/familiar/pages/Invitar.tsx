import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, X } from 'lucide-react'
import { Page, useShell } from '@/layouts/AppShell'
import { ROL_LABEL, useUser } from '@/domain/auth'
import { mutate, uid, useDB } from '@/domain/store'
import { fechaCorta } from '@/domain/dates'
import type { Rol } from '@/domain/types'
import { Badge, Button, Card, ChoicePills, Datum, SelectField, SuccessOverlay, TextField, useToast } from '@/components/ui'
import styles from './Invitar.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ROLES: Array<{ value: Extract<Rol, 'cuidador' | 'familiar'>; label: string }> = [
  { value: 'cuidador', label: 'Cuidador' },
  { value: 'familiar', label: 'Familiar' },
]
const ESTADO = {
  pendiente: { label: 'PENDIENTE', tono: 'warning' },
  aceptada: { label: 'ACEPTADA', tono: 'success' },
  rechazada: { label: 'RECHAZADA', tono: 'neutral' },
} as const

/**
 * Invitar a la familia. Es el lado EMISOR de la "Pantalla Invitación" del Figma: el familiar escribe el correo de
 * quien quiere sumar y se crea una Invitacion pendiente; quien la recibe ve "<Fulano> te ha invitado a ser parte de
 * la familia" (ver components/InvitacionOverlay.tsx) y la acepta o rechaza.
 */
export default function Invitar() {
  const user = useUser()
  const { base } = useShell()
  const navigate = useNavigate()
  const toast = useToast()
  const familias = useDB((s) => s.familias)
  const invitaciones = useDB((s) => s.invitaciones)
  const usuarios = useDB((s) => s.usuarios)

  const misFamilias = useMemo(() => familias.filter((f) => user.familiaIds.includes(f.id)), [familias, user.familiaIds])
  const enviadas = useMemo(
    () => invitaciones.filter((i) => i.invitadoPor === user.id).sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)),
    [invitaciones, user.id],
  )

  const [correo, setCorreo] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [rol, setRol] = useState<'cuidador' | 'familiar'>('cuidador')
  const [familiaId, setFamiliaId] = useState(misFamilias[0]?.id ?? '')
  const [errores, setErrores] = useState<{ correo?: string; familia?: string }>({})
  const [enviada, setEnviada] = useState(false)

  const nombreFamilia = (id: string) => familias.find((f) => f.id === id)?.nombre ?? 'Familia'

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const email = correo.trim().toLowerCase()
    const err: typeof errores = {}
    if (!email) err.correo = 'Ingresa el correo electrónico.'
    else if (!EMAIL_RE.test(email)) err.correo = 'Ingresa un correo válido (ejemplo@correo.com).'
    else if (usuarios.some((u) => u.email.toLowerCase() === email && u.familiaIds.includes(familiaId)))
      err.correo = 'Esta persona ya forma parte de la familia.'
    else if (invitaciones.some((i) => i.estado === 'pendiente' && i.familiaId === familiaId && i.email.toLowerCase() === email))
      err.correo = 'Ya hay una invitación pendiente para este correo.'
    if (!familiaId) err.familia = 'Selecciona la familia.'
    setErrores(err)
    if (Object.keys(err).length) return

    mutate((db) => {
      db.invitaciones.push({
        id: uid('inv'),
        familiaId,
        invitadoPor: user.id,
        email,
        rol,
        nombre: nombre.trim() || undefined,
        apellido: apellido.trim() || undefined,
        estado: 'pendiente',
        creadaEn: new Date().toISOString(),
      })
    })
    setEnviada(true)
  }

  const cancelar = (id: string) => {
    mutate((db) => {
      db.invitaciones = db.invitaciones.filter((i) => i.id !== id)
    })
    toast('Invitación cancelada')
  }

  return (
    <Page title="Invitar a la familia" back={base}>
      <form className="stack-lg" onSubmit={enviar} noValidate>
        <p className="muted">
          Invita a un cuidador o a otro familiar. Recibirá una invitación para ser parte de tu familia y podrá aceptarla al iniciar sesión.
        </p>

        <TextField
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="ejemplo@correo.com"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          error={errores.correo}
        />

        <div className={styles.dos}>
          <TextField label="Nombre" placeholder="Nombre" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <TextField label="Apellido" placeholder="Apellido" autoComplete="off" value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </div>

        <ChoicePills label="Invitar como" value={rol} onChange={setRol} options={ROLES} />

        {misFamilias.length > 1 ? (
          <SelectField
            label="Familia"
            required
            value={familiaId}
            onChange={(e) => setFamiliaId(e.target.value)}
            options={misFamilias.map((f) => ({ value: f.id, label: f.nombre }))}
            error={errores.familia}
          />
        ) : (
          <Datum label="Familia" value={misFamilias[0]?.nombre ?? 'Sin familia'} />
        )}

        <Button type="submit" fullWidth icon={<Send size={20} aria-hidden />}>
          Enviar invitación
        </Button>
      </form>

      <section className="stack" aria-labelledby="enviadas">
        <h2 id="enviadas" className="section-title">
          Invitaciones enviadas
        </h2>
        {enviadas.length === 0 ? (
          <p className="muted">Aún no has enviado invitaciones.</p>
        ) : (
          <ul className={styles.lista}>
            {enviadas.map((i) => {
              const est = ESTADO[i.estado]
              const quien = [i.nombre, i.apellido].filter(Boolean).join(' ')
              return (
                <li key={i.id}>
                  <Card className={styles.fila}>
                    <div className={styles.filaTexto}>
                      <strong>{quien || i.email}</strong>
                      {quien && <span className={styles.correo}>{i.email}</span>}
                      <small>
                        {ROL_LABEL[i.rol]} · {nombreFamilia(i.familiaId)} · {fechaCorta(i.creadaEn)}
                      </small>
                    </div>
                    <div className={styles.filaAcciones}>
                      <Badge tone={est.tono}>{est.label}</Badge>
                      {i.estado === 'pendiente' && (
                        <button type="button" className={styles.cancelar} onClick={() => cancelar(i.id)} aria-label={`Cancelar invitación a ${i.email}`}>
                          <X size={20} aria-hidden />
                        </button>
                      )}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <SuccessOverlay open={enviada} message="Invitación enviada correctamente!" onDone={() => navigate(base)} />
    </Page>
  )
}
