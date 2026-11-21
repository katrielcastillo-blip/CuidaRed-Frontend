/*
 * resumen-cuenta.tsx — Invitaciones pendientes y resumen de la cuenta activa en la pantalla "Mi cuenta".
 * Módulo: access-real (fase 2 · cuentas y membresías).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Las invitaciones se aceptan o rechazan con POST /me/membresias/:id/aceptar|rechazar y luego se vuelve a consultar
 * /me. El resumen muestra tipo, rol y estado de la suscripción (GET /cuentas/:id/suscripcion), los días de prueba que
 * quedan y el aviso de "sin acceso operativo" cuando la prueba o el plan vencieron. Es informativo: el servidor decide
 * qué se puede hacer en cada petición.
 */
import { useEffect, useState } from 'react'
import { Badge, Button, ButtonLink, Datum } from '@/components/ui'
import { Aviso } from '../auth/components/Piezas'
import { obtenerSuscripcion, type Suscripcion } from './api/cuentas'
import { aceptarMembresia, rechazarMembresia } from './api/miembros'
import type { CuentaMe } from './client'
import { puedeGestionarMiembros, ROL_TEXTO, suscripcionTexto, TIPO_TEXTO } from './cuentas-datos'
import { mensajeDeError } from './errores'

/* ───────────── Invitaciones pendientes ───────────── */

export function InvitacionesPendientes({ pendientes, token, onResuelta }: { pendientes: CuentaMe[]; token: string; onResuelta: () => void }) {
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')

  const resolver = async (invitacion: CuentaMe, aceptar: boolean) => {
    const membresiaId = invitacion.membresia_id
    if (!membresiaId || ocupada) return
    setOcupada(membresiaId)
    setErrores((actuales) => {
      const sinError = { ...actuales }
      delete sinError[membresiaId]
      return sinError
    })
    setAviso('')
    try {
      if (aceptar) await aceptarMembresia(token, membresiaId)
      else await rechazarMembresia(token, membresiaId)
      setAviso(
        aceptar
          ? `Aceptaste la invitación a ${invitacion.nombre}. Ya puedes trabajar en esa cuenta desde "Mis cuentas".`
          : `Rechazaste la invitación a ${invitacion.nombre}. Si fue un error, pide que te inviten de nuevo.`,
      )
      onResuelta()
    } catch (issue) {
      setErrores((actuales) => ({ ...actuales, [membresiaId]: mensajeDeError(issue) }))
    } finally {
      setOcupada(null)
    }
  }

  if (pendientes.length === 0 && !aviso) return null
  return (
    <section aria-labelledby="titulo-invitaciones" className="mb-6 flex flex-col gap-3" data-testid="invitaciones-pendientes">
      <h2 id="titulo-invitaciones" className="text-base font-semibold text-ink">
        Invitaciones pendientes
      </h2>
      {aviso && <Aviso tono="info">{aviso}</Aviso>}
      <ul className="flex flex-col gap-3">
        {pendientes.map((invitacion) => {
          const id = invitacion.membresia_id!
          const error = errores[id]
          const trabajando = ocupada === id
          return (
            <li key={id} className="flex flex-col gap-3 rounded-md border border-navy bg-blue-100 p-4">
              <p className="text-ink">
                Te invitaron a <strong>{invitacion.nombre}</strong> como <strong>{ROL_TEXTO[invitacion.rol]}</strong>
              </p>
              <Badge tone={invitacion.tipo === 'familia' ? 'info' : 'neutral'} className="self-start">
                {TIPO_TEXTO[invitacion.tipo]}
              </Badge>
              {error && <Aviso tono="error">{error}</Aviso>}
              <div className="grid grid-cols-2 gap-3">
                <Button size="sm" loading={trabajando} disabled={!!ocupada} onClick={() => void resolver(invitacion, true)}>
                  Aceptar
                </Button>
                <Button size="sm" variant="outline" disabled={!!ocupada} onClick={() => void resolver(invitacion, false)}>
                  Rechazar
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ───────────── Resumen de la cuenta activa ───────────── */

function textoPrueba(prueba: Suscripcion['prueba']) {
  if (!prueba.vigente) return null
  if (!prueba.fecha_fin) return 'Prueba gratuita vigente.'
  return `La prueba gratuita termina el ${new Date(prueba.fecha_fin).toLocaleString('es-DO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santo_Domingo' })} (hora dominicana).`
}

type EstadoCarga = { tipo: 'cargando' } | { tipo: 'lista'; datos: Suscripcion } | { tipo: 'error' }

export function ResumenCuenta({ cuenta, token, mostrarAcciones = true }: { cuenta: CuentaMe; token: string; mostrarAcciones?: boolean }) {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)

  // Al cambiar de cuenta activa se vuelve a consultar la suscripción de la cuenta nueva.
  useEffect(() => {
    let vigente = true
    obtenerSuscripcion(token, cuenta.cuenta_id)
      .then((datos) => vigente && setEstado({ tipo: 'lista', datos }))
      .catch(() => vigente && setEstado({ tipo: 'error' }))
    return () => {
      vigente = false
    }
  }, [token, cuenta.cuenta_id, intento])

  const suscripcion = estado.tipo === 'lista' ? estado.datos : null
  const estadoSuscripcion = suscripcion?.estado ?? cuenta.estado_suscripcion
  const accesoOperativo = suscripcion?.acceso_operativo ?? cuenta.acceso_operativo
  const sinAcceso = accesoOperativo === false || estadoSuscripcion === 'vencida'
  const prueba = suscripcion ? textoPrueba(suscripcion.prueba) : null

  return (
    <section aria-labelledby="titulo-resumen" className="mt-6 flex flex-col gap-3" data-testid="resumen-cuenta">
      <h2 id="titulo-resumen" className="text-base font-semibold text-ink">
        Resumen de {cuenta.nombre}
      </h2>
      <div className="grid grid-cols-2 gap-4 rounded-md border border-line-soft bg-surface p-4">
        <Datum label="Tipo de cuenta" value={TIPO_TEXTO[cuenta.tipo]} />
        <Datum label="Tu rol" value={cuenta.es_titular ? `${ROL_TEXTO[cuenta.rol]} · titular` : ROL_TEXTO[cuenta.rol]} />
        <Datum label="Suscripción" value={suscripcionTexto(estadoSuscripcion)} />
        <Datum label="Acceso a las funciones" value={sinAcceso ? 'Sin acceso operativo' : 'Con acceso operativo'} />
      </div>
      {estado.tipo === 'cargando' && (
        <p role="status" className="text-sm text-muted">
          Consultando la suscripción…
        </p>
      )}
      {estado.tipo === 'error' && (
        <Aviso tono="warning">
          <p>No se pudo consultar el detalle de la suscripción.</p>
          <Button
            variant="ghost"
            className="-ml-4"
            onClick={() => {
              setEstado({ tipo: 'cargando' })
              setIntento((n) => n + 1)
            }}
          >
            Reintentar
          </Button>
        </Aviso>
      )}
      {prueba && <Aviso tono="info">{prueba}</Aviso>}
      {sinAcceso && (
        <Aviso tono="warning">
          Esta cuenta no tiene acceso operativo. Puedes consultar sus datos y acceder a la suscripción según tu rol.
        </Aviso>
      )}
      {mostrarAcciones && <ButtonLink to={`/operacion/${encodeURIComponent(cuenta.cuenta_id)}/cuenta`} variant="outline" size="sm" className="self-start">
        Abrir cuenta
      </ButtonLink>}
      {mostrarAcciones && !sinAcceso && puedeGestionarMiembros(cuenta) && (
        <ButtonLink to="/cuenta/miembros" variant="outline" size="sm" className="self-start">
          Miembros de la cuenta
        </ButtonLink>
      )}
    </section>
  )
}
