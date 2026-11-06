/*
 * RegistroFamilia.tsx — "/registro-familia": crea una cuenta de tipo Familia con su persona Coordinadora
 * (Reglas de Negocio V2 §Cuenta: en Familia no hay Administrador; la Coordinadora es la titular y gestiona accesos).
 *  1) Tu familia (nombre, categoría de Familia, provincia y municipio)  2) Persona coordinadora (Usuario)
 *  3) Contraseña + aceptación de términos y privacidad.
 * La cuenta nace con 7 días de prueba gratuita (sin tarjeta) y funciones limitadas.
 * Módulo: auth (SRS §8.2.2.3.5 b · Ley 172-13).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift } from 'lucide-react'
import { Button, SelectField, StepBar, TextField } from '@/components/ui'
import { HOME_BY_ROL } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { DIAS_PRUEBA_GRATUITA } from '@/domain/planes'
import { useDB } from '@/domain/store'
import { useBorrador } from '@/lib/useBorrador'
import { AuthScreen } from '../components/AuthScreen'
import { CamposClave, CamposTitular, SelectoresUbicacion } from '../components/CamposCuenta'
import { LogoBadge } from '../components/LogoBadge'
import { Acciones, Aviso, Lead, YaTienesCuenta } from '../components/Piezas'
import {
  categoriasDeTipo,
  guardarMemoria,
  leerMemoria,
  limpiarMemoria,
  registrarFamilia,
  ROL_TITULAR,
  validarFamilia,
  validarTitular,
  type Errores,
} from '../lib/registro'
import { errorConfirmacion, hayErrores } from '../lib/validar'

const FLUJO = 'familia'
const INICIAL = {
  paso: 1,
  nombreFamilia: '',
  categoriaCuentaId: '',
  provinciaCod: '',
  municipioCod: '',
  cedula: '',
  nombre: '',
  apellido: '',
  telefono: '',
  email: '',
}
type Campo = Exclude<keyof typeof INICIAL, 'paso'>
const TOTAL = 3
const NOMBRE_PASO = ['Tu familia', 'Persona coordinadora', 'Contraseña']
/** Campos validados en cada paso (para volver al paso con errores si el servidor los rechaza). */
const CAMPOS_PASO: Record<number, string[]> = {
  1: ['nombreFamilia', 'categoriaCuentaId', 'provinciaCod', 'municipioCod'],
  2: ['cedula', 'nombre', 'apellido', 'telefono', 'email'],
}

export default function RegistroFamilia() {
  const navigate = useNavigate()
  const enLinea = useEnLinea()
  const catalogos = useDB((s) => s.catalogos)
  const [d, setD, descartar] = useBorrador('cuenta-familia', INICIAL)
  const [memoria] = useState(() => leerMemoria(FLUJO))
  const [password, setPassword] = useState(memoria.password)
  const [confirmar, setConfirmar] = useState(memoria.confirmar)
  const [acepto, setAcepto] = useState(memoria.acepto)
  const [errores, setErrores] = useState<Errores>({})
  const [general, setGeneral] = useState<string>()
  const [cargando, setCargando] = useState(false)
  const paso = Math.min(Math.max(d.paso, 1), TOTAL)

  const categorias = useMemo(() => categoriasDeTipo(catalogos, 'familia').map((c) => ({ value: c.id, label: c.nombre })), [catalogos])

  const set = (campo: Campo, valor: string) => {
    setD((x) => ({ ...x, [campo]: valor }))
    setErrores((x) => ({ ...x, [campo]: undefined }))
    setGeneral(undefined)
  }
  const recordar = (m: Partial<{ password: string; confirmar: string; acepto: boolean }>) => guardarMemoria(FLUJO, { password, confirmar, acepto, ...m })
  const irA = (p: number) => {
    setErrores({})
    setGeneral(undefined)
    setD((x) => ({ ...x, paso: p }))
  }
  const cancelar = () => {
    descartar()
    limpiarMemoria(FLUJO)
    navigate('/inicio')
  }
  const volver = () => (paso > 1 ? irA(paso - 1) : navigate('/crear-cuenta'))

  const familia = {
    nombre: d.nombreFamilia,
    categoriaCuentaId: d.categoriaCuentaId,
    provinciaCod: d.provinciaCod,
    municipioCod: d.municipioCod,
    direccion: '',
    telefono: '',
    correo: '',
  }
  const coordinadora = { cedula: d.cedula, nombre: d.nombre, apellido: d.apellido, telefono: d.telefono, email: d.email }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (cargando) return
    if (paso < TOTAL) {
      const v = paso === 1 ? validarFamilia(familia) : validarTitular(coordinadora)
      setErrores(v)
      if (!hayErrores(v)) irA(paso + 1)
      return
    }
    const local: Errores = { confirmar: errorConfirmacion(password, confirmar) }
    setCargando(true)
    try {
      const res = await registrarFamilia(familia, coordinadora, password, acepto)
      if (res.ok) {
        descartar()
        limpiarMemoria(FLUJO)
        navigate(HOME_BY_ROL[ROL_TITULAR.familia], { replace: true })
        return
      }
      const errs = { ...local, ...('errores' in res ? res.errores : undefined) }
      const pasoConError = [1, 2].find((p) => CAMPOS_PASO[p]!.some((c) => errs[c]))
      if (pasoConError) setD((x) => ({ ...x, paso: pasoConError }))
      setErrores(errs)
      setGeneral(hayErrores(errs) ? undefined : res.error)
    } finally {
      setCargando(false)
    }
  }

  const nombreFamilia = d.nombreFamilia.trim() || 'tu familia'

  return (
    <AuthScreen title="Crear cuenta familiar" back={volver}>
      <form className="flex min-w-0 flex-1 flex-col gap-5" onSubmit={enviar} noValidate aria-busy={cargando || undefined}>
        <LogoBadge />
        <StepBar step={paso} total={TOTAL} />
        <p className="-mt-2 text-sm font-semibold text-muted">
          Paso {paso} de {TOTAL} · {NOMBRE_PASO[paso - 1]}
        </p>

        {!enLinea && <Aviso tono="offline">Sin conexión: necesitas internet para crear la cuenta.</Aviso>}

        {paso === 1 && (
          <>
            <Lead>Crea la cuenta de tu familia para organizar el cuidado de tus adultos mayores y mantener a todos informados.</Lead>
            <Aviso tono="info" icono={<Gift size={18} />}>
              <strong>{DIAS_PRUEBA_GRATUITA} días gratis, sin tarjeta.</strong> Empiezas con una prueba de funciones limitadas; cuando esté por terminar podrás elegir un plan.
            </Aviso>
            <TextField
              label="Nombre de la familia"
              placeholder="Familia Méndez"
              value={d.nombreFamilia}
              error={errores.nombreFamilia}
              help="Cómo quieres que se llame la cuenta. Por ejemplo, «Familia Méndez»."
              onChange={(e) => set('nombreFamilia', e.target.value)}
            />
            <SelectField
              label="Categoría"
              placeholder="Seleccionar"
              options={categorias}
              value={d.categoriaCuentaId}
              error={errores.categoriaCuentaId}
              help="Monitoreo a distancia: no viven con la persona mayor. Cuidado domiciliario: la cuidan en casa de forma continua. Cuidado temporal: por una etapa o un periodo."
              onChange={(e) => set('categoriaCuentaId', e.target.value)}
            />
            <SelectoresUbicacion
              provinciaCod={d.provinciaCod}
              municipioCod={d.municipioCod}
              errores={errores}
              onProvincia={(cod) => {
                set('provinciaCod', cod)
                setD((x) => ({ ...x, municipioCod: '' }))
              }}
              onMunicipio={(cod) => set('municipioCod', cod)}
            />
          </>
        )}

        {paso === 2 && (
          <>
            <Lead>
              Datos de la persona que coordinará a <strong className="text-ink">{nombreFamilia}</strong>. Será la titular de la cuenta: registra a los adultos
              mayores e invita a cuidadores y familiares.
            </Lead>
            <CamposTitular valores={coordinadora} errores={errores} onCambio={(campo, valor) => set(campo, valor)} />
          </>
        )}

        {paso === 3 && (
          <>
            <Lead>Crea la contraseña de la persona coordinadora.</Lead>
            <CamposClave
              id="requisitos-familia"
              password={password}
              confirmar={confirmar}
              acepto={acepto}
              errores={errores}
              onPassword={(v) => {
                setPassword(v)
                recordar({ password: v })
                setErrores((x) => ({ ...x, password: undefined }))
              }}
              onConfirmar={(v) => {
                setConfirmar(v)
                recordar({ confirmar: v })
                setErrores((x) => ({ ...x, confirmar: undefined }))
              }}
              onAcepto={(v) => {
                setAcepto(v)
                recordar({ acepto: v })
                setErrores((x) => ({ ...x, acepto: undefined }))
              }}
            />
          </>
        )}

        {general && <Aviso tono="error">{general}</Aviso>}

        <Acciones>
          <Button type="submit" variant={paso === TOTAL ? 'primary' : 'light'} fullWidth loading={cargando} disabled={!enLinea}>
            {paso === TOTAL ? (cargando ? 'Creando cuenta…' : 'Crear cuenta familiar') : 'Siguiente'}
          </Button>
          <Button variant="ghost" fullWidth onClick={cancelar}>
            Cancelar
          </Button>
          <YaTienesCuenta />
        </Acciones>
      </form>
    </AuthScreen>
  )
}
