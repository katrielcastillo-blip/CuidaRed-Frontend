import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, StepBar, TextField } from '@/components/ui'
import { AuthScreen } from '../components/AuthScreen'
import { LogoBadge } from '../components/LogoBadge'
import { cedulaRegistrada, guardarBorrador, leerBorrador } from '../lib/registro'
import { errorCedula, errorNombre, errorTelefono, formatCedula, formatTelefono, hayErrores } from '../lib/validar'
import a from '../components/Auth.module.css'

interface Errores {
  cedula?: string
  nombre?: string
  apellido?: string
  telefono?: string
}

/** "/registro" — Registrarse paso 1 (Figma 255:499): cédula, nombre, apellido y teléfono. */
export default function Registro() {
  const navigate = useNavigate()
  const [datos] = useState(() => leerBorrador())
  const [cedula, setCedula] = useState(datos?.cedula ?? '')
  const [nombre, setNombre] = useState(datos?.nombre ?? '')
  const [apellido, setApellido] = useState(datos?.apellido ?? '')
  const [telefono, setTelefono] = useState(datos?.telefono ?? '')
  const [errores, setErrores] = useState<Errores>({})

  const limpiar = (campo: keyof Errores) => setErrores((x) => ({ ...x, [campo]: undefined }))

  const siguiente = (e: FormEvent) => {
    e.preventDefault()
    const nuevos: Errores = {
      cedula: errorCedula(cedula) ?? (cedulaRegistrada(cedula) ? 'Ya existe una cuenta con esta cédula.' : undefined),
      nombre: errorNombre(nombre, 'nombre'),
      apellido: errorNombre(apellido, 'apellido'),
      telefono: errorTelefono(telefono),
    }
    setErrores(nuevos)
    if (hayErrores({ ...nuevos })) return
    guardarBorrador({ cedula, nombre: nombre.trim(), apellido: apellido.trim(), telefono })
    navigate('/registro/cuenta')
  }

  return (
    <AuthScreen title="Crear Cuenta" back="/inicio">
      <form className={a.form} onSubmit={siguiente} noValidate>
        <LogoBadge />
        <div className={a.steps}>
          <StepBar step={1} total={2} />
        </div>

        <div className={a.grid2}>
          <div className={a.span2}>
            <TextField
              label="Cédula"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000-0000000-0"
              maxLength={13}
              value={cedula}
              error={errores.cedula}
              onChange={(e) => {
                setCedula(formatCedula(e.target.value))
                limpiar('cedula')
              }}
            />
          </div>
          <TextField
            label="Nombre"
            autoComplete="given-name"
            placeholder="Nombre"
            value={nombre}
            error={errores.nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              limpiar('nombre')
            }}
          />
          <TextField
            label="Apellido"
            autoComplete="family-name"
            placeholder="Apellido"
            value={apellido}
            error={errores.apellido}
            onChange={(e) => {
              setApellido(e.target.value)
              limpiar('apellido')
            }}
          />
          <div className={a.span2}>
            <TextField
              label="Teléfono"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="000 000 0000"
              maxLength={12}
              value={telefono}
              error={errores.telefono}
              onChange={(e) => {
                setTelefono(formatTelefono(e.target.value))
                limpiar('telefono')
              }}
            />
          </div>
        </div>

        <div className={a.actions}>
          <Button type="submit" variant="light" fullWidth>
            Siguiente
          </Button>
          <p className={a.centro}>
            ¿Ya tienes una cuenta?{' '}
            <Link to="/inicio" className={a.enlace}>
              Iniciar sesión
            </Link>
          </p>
        </div>
      </form>
    </AuthScreen>
  )
}
