/*
 * ContactosSeccion.tsx — Contactos de emergencia del adulto mayor (tabla Contacto_emergencia: nombres,
 * apellidos, Parentesco, teléfono, Es_Principal). Lista con el principal destacado y, con permiso
 * adultos:editar, agregar, editar, marcar como principal y eliminar (guardarContacto / eliminarContacto).
 * Módulo: gestión (administrador y coordinador).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react'
import { Badge, Button, Checkbox, SelectField, Sheet, TextField, useToast } from '@/components/ui'
import { eliminarContacto, guardarContacto, PARENTESCOS, type DatosContacto } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { contactosDe, nombreContacto } from '@/domain/relaciones'
import { useDB } from '@/domain/store'
import type { Adulto, ContactoEmergencia } from '@/domain/types'
import { cn } from '@/lib/cn'
import { maskTelefono, opcionesParentesco } from '../../lib/formato'
import { NotaInfo, Seccion } from '../Piezas'

const VACIO: DatosContacto = { nombres: '', apellidos: '', parentesco: '', telefono: '', esPrincipal: false }
type Errores = Partial<Record<keyof DatosContacto, string | undefined>>

export function ContactosSeccion({ adulto, editable, className }: { adulto: Adulto; editable: boolean; className?: string }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const todos = useDB((s) => s.contactos)
  const contactos = useMemo(() => contactosDe(todos, adulto.id), [todos, adulto.id])

  const [form, setForm] = useState<{ id?: string; datos: DatosContacto } | null>(null)
  const [errores, setErrores] = useState<Errores>({})
  const [borrar, setBorrar] = useState<ContactoEmergencia | null>(null)
  const cerrar = useCallback(() => {
    setForm(null)
    setErrores({})
  }, [])
  const cerrarBorrar = useCallback(() => setBorrar(null), [])

  const abrir = (c?: ContactoEmergencia) =>
    setForm(c ? { id: c.id, datos: { nombres: c.nombres, apellidos: c.apellidos, parentesco: c.parentesco, telefono: c.telefono, esPrincipal: c.esPrincipal } } : { datos: { ...VACIO, esPrincipal: contactos.length === 0 } })

  const set = <K extends keyof DatosContacto>(k: K, v: DatosContacto[K]) => {
    setForm((f) => (f ? { ...f, datos: { ...f.datos, [k]: v } } : f))
    if (errores[k]) setErrores((e) => ({ ...e, [k]: undefined }))
  }

  const guardar = (ev: FormEvent) => {
    ev.preventDefault()
    if (!form) return
    const r = guardarContacto(user, adulto.id, form.datos, form.id)
    if (!r.ok) {
      setErrores((r.errores ?? {}) as Errores)
      toast(r.error, 'error')
      return
    }
    toast(form.id ? 'Contacto actualizado' : 'Contacto agregado')
    cerrar()
  }

  const hacerPrincipal = (c: ContactoEmergencia) => {
    const r = guardarContacto(user, adulto.id, { nombres: c.nombres, apellidos: c.apellidos, parentesco: c.parentesco, telefono: c.telefono, esPrincipal: true }, c.id)
    if (!r.ok) return toast(r.error, 'error')
    toast(`${nombreContacto(c)} es ahora el contacto principal`)
  }

  const confirmarBorrar = () => {
    if (!borrar) return
    const r = eliminarContacto(user, borrar.id)
    setBorrar(null)
    if (!r.ok) return toast(r.error, 'error')
    toast('Contacto eliminado')
  }

  return (
    <Seccion
      titulo="Contactos de emergencia"
      id="contactos"
      className={className}
      accion={
        editable && (
          <Button size="sm" variant="light" icon={<Plus size={18} aria-hidden />} onClick={() => abrir()} disabled={!enLinea}>
            Agregar
          </Button>
        )
      }
    >
      {contactos.length === 0 ? (
        <NotaInfo tono="aviso">No hay contactos de emergencia registrados.{editable ? ' Agrega al menos uno.' : ''}</NotaInfo>
      ) : (
        <ul className="flex flex-col gap-2">
          {contactos.map((c) => (
            <li key={c.id} className={cn('flex flex-col gap-2 p-3 rounded-sm border bg-surface', c.esPrincipal ? 'border-navy border-l-4' : 'border-line-soft')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0 leading-tight">
                  <strong className="text-base text-ink wrap-anywhere">{nombreContacto(c)}</strong>
                  <span className="text-sm text-muted">{c.parentesco}</span>
                </div>
                {c.esPrincipal && (
                  <Badge tone="navy">
                    <Star size={11} aria-hidden /> Principal
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`tel:${c.telefono.replace(/\D/g, '')}`} className="inline-flex items-center gap-2 min-h-12 px-3 -ml-3 rounded-sm text-navy font-semibold hover:bg-blue-100" aria-label={`Llamar a ${nombreContacto(c)}: ${c.telefono}`}>
                  <Phone size={18} aria-hidden /> {c.telefono}
                </a>
                {editable && (
                  <span className="flex flex-wrap gap-1 ml-auto">
                    {!c.esPrincipal && (
                      <Button size="sm" variant="outline" onClick={() => hacerPrincipal(c)} disabled={!enLinea}>
                        Hacer principal
                      </Button>
                    )}
                    <button type="button" className="size-12 grid place-items-center rounded-full text-navy hover:bg-blue-100 disabled:opacity-50" aria-label={`Editar a ${nombreContacto(c)}`} onClick={() => abrir(c)} disabled={!enLinea}>
                      <Pencil size={18} aria-hidden />
                    </button>
                    {contactos.length > 1 && (
                      <button type="button" className="size-12 grid place-items-center rounded-full text-danger hover:bg-danger-100 disabled:opacity-50" aria-label={`Eliminar a ${nombreContacto(c)}`} onClick={() => setBorrar(c)} disabled={!enLinea}>
                        <Trash2 size={18} aria-hidden />
                      </button>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!form} onClose={cerrar} title={form?.id ? 'Editar contacto' : 'Nuevo contacto de emergencia'}>
        {form && (
          <form className="flex flex-col gap-3" onSubmit={guardar} noValidate>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Nombres" required autoComplete="off" maxLength={60} value={form.datos.nombres} onChange={(e) => set('nombres', e.target.value)} error={errores.nombres} />
              <TextField label="Apellidos" required autoComplete="off" maxLength={60} value={form.datos.apellidos} onChange={(e) => set('apellidos', e.target.value)} error={errores.apellidos} />
              <SelectField
                label="Parentesco"
                required
                placeholder="Seleccionar"
                value={form.datos.parentesco}
                onChange={(e) => set('parentesco', e.target.value)}
                options={opcionesParentesco(PARENTESCOS, form.datos.parentesco)}
                error={errores.parentesco}
              />
              <TextField
                label="Teléfono"
                required
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                placeholder="809 000 0000"
                value={form.datos.telefono}
                onChange={(e) => set('telefono', maskTelefono(e.target.value))}
                error={errores.telefono}
              />
            </div>
            <Checkbox
              label="Contacto principal (a quien se llama primero)"
              checked={form.datos.esPrincipal}
              disabled={contactos.length === 0 || (contactos.length === 1 && !!form.id)}
              onChange={(e) => set('esPrincipal', e.target.checked)}
            />
            {!enLinea && <NotaInfo tono="aviso">Sin conexión: guardar contactos necesita internet.</NotaInfo>}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" onClick={cerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!enLinea}>
                Guardar
              </Button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet
        open={!!borrar}
        onClose={cerrarBorrar}
        title="Eliminar contacto"
        footer={
          <>
            <Button variant="outline" onClick={cerrarBorrar}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarBorrar} disabled={!enLinea}>
              Eliminar
            </Button>
          </>
        }
      >
        {borrar && (
          <p>
            ¿Eliminar a <b>{nombreContacto(borrar)}</b> ({borrar.parentesco}) de los contactos de emergencia?
            {borrar.esPrincipal ? ' Es el contacto principal: el siguiente de la lista pasará a ser el principal.' : ''}
          </p>
        )}
      </Sheet>
    </Seccion>
  )
}
