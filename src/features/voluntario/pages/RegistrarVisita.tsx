/*
 * RegistrarVisita.tsx — Registro mínimo de la visita del voluntario: elegir el adulto (o venir de una visita
 * programada), confirmar "La visita se realizó" y escribir la observación (CU-05 en su versión de voluntario).
 * Módulo: voluntario (V2 §Visita: el voluntario únicamente registra que la visita ocurrió y deja una observación;
 * RF-06 validación junto al campo y borrador; RF-10 funciona sin conexión).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 *   ?visita=:id   completa una visita programada para este voluntario (el adulto ya viene elegido).
 *   ?adulto=:id   visita no programada a ese adulto (debe estar asignado al voluntario).
 *   sin parámetros: lista con los adultos asignados.
 *
 * Pasos para el voluntario: elegir adulto (si no viene elegido) → confirmar que se realizó → escribir la observación →
 * guardar (4 como máximo, RNF-2.1). El estado del adulto, los aspectos verificados y las evidencias no se piden:
 * se guarda con `minima: true`. Lo escrito se conserva como borrador (useFormulario → useBorrador).
 */
import { useMemo, useState, type FormEvent } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { CircleCheckBig, CircleUserRound } from 'lucide-react'
import { registrarVisita } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { hhmmA12, pad, toISODate } from '@/domain/dates'
import { puede } from '@/domain/permisos'
import { useDB } from '@/domain/store'
import type { Adulto, Usuario, Visita } from '@/domain/types'
import { errorTexto } from '@/domain/validacion'
import { AvisoBorrador, Button, ButtonLink, Card, Checkbox, EmptyState, IconTile, requerido, SelectField, SuccessOverlay, TextareaAbreviado, useFormulario, useToast } from '@/components/ui'
import { Page, useShell } from '@/layouts/AppShell'
import { cn } from '@/lib/cn'
import { DatosAdulto, NoEncontrado, SyncBadge } from '../components/Piezas'
import { etiquetaDia, OBSERVACION_MAX, OBSERVACION_MIN, RAZON_VOLUNTARIO, useFicha, useMisAdultos, type FichaAdulto } from '../lib/datos'

const TITULO = 'Registrar visita'
const DETALLE_OFFLINE = 'Guardada en el dispositivo · Pendiente de sincronización'

/** "HH:MM" local de una fecha. */
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

interface Valores {
  adultoId: string
  /** Confirmación "La visita se realizó". */
  realizada: boolean
  observaciones: string
}

interface Registrada {
  visita: Visita
  nombre: string
  offline: boolean
}

export function RegistrarVisita() {
  const user = useUser()
  const location = useLocation()
  const [params] = useSearchParams()
  const visitaId = params.get('visita') ?? undefined
  const adultoParam = params.get('adulto') ?? undefined
  const visitas = useDB((s) => s.visitas)
  const adultos = useMisAdultos()
  // Una vez registrada se muestra el resultado (la visita pasa a "completada" y ya no se puede volver a registrar).
  const [registrada, setRegistrada] = useState<(Registrada & { key: string }) | null>(null)

  // Solo las visitas de las que es responsable y de adultos que tiene asignados.
  const visita = useMemo(() => (visitaId ? visitas.find((v) => v.id === visitaId && v.cuidadorId === user.id) : undefined), [visitas, visitaId, user.id])
  const adultoFijo = useMemo(() => {
    const id = visita?.adultoId ?? adultoParam
    return id ? adultos.find((a) => a.id === id) : undefined
  }, [adultos, visita, adultoParam])

  if (registrada && registrada.key === location.key) return <Resultado visita={registrada.visita} nombre={registrada.nombre} offline={registrada.offline} />
  if (!puede(user, 'visitas:registrar')) return <NoEncontrado titulo={TITULO} />
  // Inexistente o fuera de su alcance: mismo mensaje (no revela si existe).
  if ((visitaId && !visita) || ((visitaId || adultoParam) && !adultoFijo)) return <NoEncontrado titulo={TITULO} />
  if (visita && (visita.estado === 'completada' || visita.estado === 'cancelada')) return <VisitaCerrada />
  if (!adultoFijo && adultos.length === 0) {
    return (
      <Page title={TITULO} back>
        <EmptyState title="Aún no tienes adultos asignados" text="El coordinador te asignará los adultos mayores que debes visitar." />
      </Page>
    )
  }

  const clave = `voluntario:visita:${user.id}:${visitaId ?? adultoParam ?? 'nueva'}`
  return <Formulario key={clave} clave={clave} user={user} visita={visita} adultoFijo={adultoFijo} adultos={adultos} onRegistrada={(r) => setRegistrada({ ...r, key: location.key })} />
}

function Formulario({
  clave,
  user,
  visita,
  adultoFijo,
  adultos,
  onRegistrada,
}: {
  clave: string
  user: Usuario
  visita?: Visita
  adultoFijo?: Adulto
  adultos: Adulto[]
  onRegistrada: (r: Registrada) => void
}) {
  const toast = useToast()
  const enLinea = useEnLinea()
  const ficha = useFicha()

  const f = useFormulario<Valores>({
    clave,
    inicial: { adultoId: adultoFijo?.id ?? '', realizada: false, observaciones: '' },
    campos: ['adultoId', 'realizada', 'observaciones'],
    reglas: {
      adultoId: requerido('Elige a qué adulto mayor visitaste.'),
      realizada: requerido('Confirma que la visita se realizó.'),
      observaciones: (v) => errorTexto(v, 'la observación', OBSERVACION_MIN, OBSERVACION_MAX),
    },
  })

  const adulto = adultoFijo ?? adultos.find((a) => a.id === f.valores.adultoId)
  const fichaAdulto: FichaAdulto | undefined = adulto ? ficha(adulto) : undefined

  /** Envía el formulario: valida junto a cada campo y, si todo está bien, guarda la visita (en línea o en el dispositivo). */
  async function alEnviar(e: FormEvent) {
    const salida: { registrada: Registrada | null } = { registrada: null }
    const malo = await f.enviar(async (v) => {
      const ahora = new Date()
      try {
        const res = await registrarVisita(user, {
          visitaId: visita?.id,
          adultoId: v.adultoId,
          responsableId: user.id,
          razon: RAZON_VOLUNTARIO,
          detallesAdicionales: [],
          fecha: toISODate(ahora),
          hora: hhmm(ahora),
          estadoAdulto: '',
          observaciones: v.observaciones,
          checklist: [],
          evidencias: [],
          minima: true,
        })
        if (!res.ok) {
          toast(res.error, 'error')
          return { ok: false, errores: { adultoId: res.errores?.adulto, observaciones: res.errores?.observaciones } }
        }
        salida.registrada = { visita: res.valor, nombre: fichaAdulto?.nombre ?? 'Adulto mayor', offline: !!res.offline }
        return undefined
      } catch {
        toast('No pudimos guardar la visita. Inténtalo de nuevo: lo que escribiste sigue aquí.', 'error')
        return { ok: false }
      }
    })(e)
    if (!malo && salida.registrada) onRegistrada(salida.registrada)
  }

  return (
    <Page title={TITULO} back>
      <form className="flex flex-col gap-5" onSubmit={alEnviar} noValidate aria-label="Registro de visita">
        <AvisoBorrador formulario={f} />

        {adultoFijo && fichaAdulto ? (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <IconTile>
                <CircleUserRound size={26} strokeWidth={1.7} aria-hidden />
              </IconTile>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="text-xs text-ink-2">Adulto mayor visitado</p>
                <p className="text-lg font-semibold leading-tight text-ink wrap-anywhere">{fichaAdulto.nombre}</p>
                {visita && (
                  <p className="text-sm font-semibold text-navy">
                    Visita programada · {etiquetaDia(visita.fecha)} · {hhmmA12(visita.horaPautada)}
                  </p>
                )}
              </div>
            </div>
            <DatosAdulto ficha={fichaAdulto} />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            <SelectField
              label="Adulto mayor visitado"
              required
              placeholder="Selecciona un adulto"
              options={adultos.map((a) => ({ value: a.id, label: ficha(a).nombre }))}
              help="Solo aparecen los adultos mayores que el coordinador te asignó."
              {...f.campo('adultoId')}
            />
            {fichaAdulto && <DatosAdulto ficha={fichaAdulto} className="px-1" />}
          </div>
        )}

        <div className={cn('rounded-sm border bg-surface-2/50 px-4', f.errores.realizada ? 'border-danger pb-3' : 'border-line')}>
          <Checkbox label="La visita se realizó" required className="text-base font-semibold text-ink" {...f.casilla('realizada')} />
        </div>

        <TextareaAbreviado
          label="Observación"
          required
          rows={4}
          maxLength={OBSERVACION_MAX}
          placeholder="Ej.: lo encontré de buen ánimo, conversamos un rato"
          hint={`Cuenta cómo fue la visita, de ${OBSERVACION_MIN} a ${OBSERVACION_MAX} caracteres. Puedes usar abreviaturas.`}
          {...f.abreviado('observaciones')}
        />

        {!enLinea && (
          <p className="text-sm font-semibold text-warning-700" role="status">
            Sin conexión: la visita se guardará en el dispositivo y se enviará sola al volver la conexión.
          </p>
        )}

        <Button type="submit" fullWidth loading={f.enviando}>
          Guardar visita
        </Button>
      </form>
    </Page>
  )
}

/** Tras guardar: confirmación (SuccessOverlay), estado de sincronización y siguientes pasos. */
function Resultado({ visita, nombre, offline }: Registrada) {
  const { base } = useShell()
  const visitas = useDB((s) => s.visitas)
  const [overlay, setOverlay] = useState(true)
  // Estado actual en la vista: al sincronizarse deja de estar pendiente aunque la pantalla siga abierta.
  const actual = visitas.find((v) => v.id === visita.id)
  const pendiente = offline && (actual ? !!actual.pendienteSync : true)
  return (
    <Page title="Visita registrada" back={base}>
      <Card className="flex flex-col items-center gap-3 py-6 text-center">
        <CircleCheckBig size={48} className="text-success-700" aria-hidden />
        <h2 className="text-xl font-bold text-ink">Tu visita quedó registrada</h2>
        <p className="text-ink-2 wrap-anywhere">{nombre}</p>
        {pendiente ? (
          <>
            <SyncBadge />
            <p className="text-sm text-ink-2">Se guardó en este dispositivo y se enviará sola cuando vuelva la conexión.</p>
          </>
        ) : (
          <p className="text-sm text-ink-2">Tu observación quedó guardada.</p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        <ButtonLink fullWidth to={base}>
          Volver al inicio
        </ButtonLink>
        <ButtonLink variant="outline" fullWidth to={`${base}/visitas/nueva`} replace>
          Registrar otra visita
        </ButtonLink>
        <ButtonLink variant="ghost" fullWidth to={`${base}/visitas`}>
          Ver mis visitas
        </ButtonLink>
      </div>

      <SuccessOverlay open={overlay} message="Visita registrada" detail={offline ? DETALLE_OFFLINE : undefined} duration={offline ? 3000 : 2200} onDone={() => setOverlay(false)} />
    </Page>
  )
}

function VisitaCerrada() {
  const { base } = useShell()
  return (
    <Page title={TITULO} back>
      <div className="min-h-[40vh] grid place-items-center">
        <EmptyState
          title="Esta visita ya fue registrada"
          text="Ya no se puede registrar de nuevo."
          action={
            <ButtonLink variant="outline" size="sm" to={`${base}/visitas`} replace>
              Ver mis visitas
            </ButtonLink>
          }
        />
      </div>
    </Page>
  )
}
