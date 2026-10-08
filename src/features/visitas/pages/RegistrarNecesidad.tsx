import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Laugh } from 'lucide-react'
import { nombreCompleto, useSession } from '@/domain/auth'
import { mutate, uid, useDB } from '@/domain/store'
import type { EstadoNecesidad, Necesidad, TipoNecesidad } from '@/domain/types'
import { Button, ChoicePills, EmptyState, SelectField, SuccessOverlay, TextareaField } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { AdultoHeader } from '../components/AdultoHeader'
import { TileSelect } from '../components/TileSelect'
import { TIPOS_NECESIDAD, useAdultosElegibles } from '../lib/dominio'
import comun from './Comun.module.css'
import styles from './RegistrarNecesidad.module.css'

type Errores = { adulto?: string; tipo?: string; descripcion?: string }

/** Registrar Necesidad: cuidador (Figma 358:2856) y coordinador (488:2439). `?adulto=:id` fija el adulto; sin él hay selector. */
export function RegistrarNecesidad() {
  const { user } = useSession()
  const { base } = useShell()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const adultoParam = params.get('adulto')
  const adultos = useDB((s) => s.adultos)
  const elegibles = useAdultosElegibles()
  const esCoord = user?.rol === 'coordinador'

  const [adultoSel, setAdultoSel] = useState(adultoParam ?? '')
  const [tipo, setTipo] = useState<TipoNecesidad | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState<EstadoNecesidad>('activa')
  const [errores, setErrores] = useState<Errores>({})
  const [exito, setExito] = useState<string | null>(null)

  const adulto = adultos.find((a) => a.id === adultoSel)

  function registrar(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    const errs: Errores = {}
    if (!adulto) errs.adulto = 'Selecciona el adulto mayor.'
    if (!tipo) errs.tipo = 'Elige el tipo de necesidad.'
    if (descripcion.trim().length < 5) errs.descripcion = 'Describe la necesidad (mínimo 5 caracteres).'
    setErrores(errs)
    if (!adulto || !tipo || Object.keys(errs).length > 0) return

    const nueva: Necesidad = {
      id: uid('n'),
      adultoId: adulto.id,
      registradaPor: user.id,
      tipo,
      descripcion: descripcion.trim(),
      estado,
      creadaEn: new Date().toISOString(),
    }
    mutate((db) => {
      db.necesidades.push(nueva)
    })
    setExito(nueva.id)
  }

  return (
    <Page title="Registrar Necesidad" back>
      <form className={comun.cuerpo} onSubmit={registrar} noValidate>
        {adultoParam ? (
          adulto ? (
            <AdultoHeader adulto={adulto} />
          ) : (
            <EmptyState title="Adulto no encontrado" text="Elige otro adulto desde la lista." />
          )
        ) : (
          <>
            <SelectField
              label="Adulto mayor"
              required
              placeholder="Selecciona un adulto"
              value={adultoSel}
              onChange={(e) => {
                setAdultoSel(e.target.value)
                if (errores.adulto) setErrores((x) => ({ ...x, adulto: undefined }))
              }}
              error={errores.adulto}
              options={elegibles.map((a) => ({ value: a.id, label: nombreCompleto(a) }))}
            />
            {adulto && <AdultoHeader adulto={adulto} />}
          </>
        )}

        <div className={styles.panel}>
          <TileSelect
            label="Tipo de Necesidad"
            value={tipo}
            onChange={(v) => {
              setTipo(v)
              setErrores((x) => ({ ...x, tipo: undefined }))
            }}
            options={TIPOS_NECESIDAD}
            columnas={3}
            columnasWide={5}
            error={errores.tipo}
          />
          <TextareaField
            label="Descripción"
            placeholder="Describe la necesidad del adulto mayor"
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value)
              if (errores.descripcion) setErrores((x) => ({ ...x, descripcion: undefined }))
            }}
            error={errores.descripcion}
            rows={5}
          />
          <ChoicePills<EstadoNecesidad>
            label="Estado"
            value={estado}
            onChange={setEstado}
            options={[
              { value: 'activa', label: 'Activa' },
              { value: 'inactiva', label: 'Inactiva' },
            ]}
          />
        </div>

        <div className={comun.acciones}>
          {esCoord ? (
            <>
              <Button type="submit" fullWidth>
                Registrar necesidad
              </Button>
              <Button variant="outline" fullWidth onClick={() => navigate(-1)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button type="submit" variant="soft" fullWidth>
              Registrar Necesidad
            </Button>
          )}
        </div>
      </form>

      <SuccessOverlay
        open={exito !== null}
        message="Necesidad registrada correctamente!"
        icon={<Laugh size={72} strokeWidth={1.6} aria-hidden />}
        onDone={() => exito && navigate(`${base}/necesidades/${exito}`, { replace: true })}
      />
    </Page>
  )
}
