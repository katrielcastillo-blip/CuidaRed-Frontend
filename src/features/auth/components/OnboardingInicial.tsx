/*
 * OnboardingInicial.tsx — Guía de bienvenida de 3 o 4 pasos que se muestra la primera vez que una persona
 * entra con un rol: explica para qué sirve la app según su rol y el tipo de cuenta (Familia u Organización).
 * Módulo: auth (feedback de PM sobre LOGIN SCREEN · RF-06 objetivos táctiles de 48 px · WCAG diálogo modal).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Componente autónomo: se monta una vez dentro de la app autenticada (<OnboardingInicial />), lee la sesión con
 * useSession() y no recibe props. Se ve una sola vez por usuario y rol (localStorage `cuidared:onboarding:<userId>:<rol>`).
 * `GuiaDialogo` es la parte de presentación (sin store) por si otro modo de la app debe mostrar la misma guía.
 *
 * Accesibilidad: diálogo modal (role="dialog" aria-modal) con foco atrapado, Esc para saltar, foco devuelto al
 * elemento previo, fondo sin desplazamiento y anuncio de cada paso. No cierra al tocar el fondo para no
 * perder la guía por un toque accidental.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, BellRing, ClipboardList, Gift, HeartHandshake, Lock, PartyPopper, Pill, Siren, Users, WifiOff, type LucideIcon } from 'lucide-react'
import { Button, StepBar } from '@/components/ui'
import { useSession } from '@/domain/auth'
import { diasRestantesPrueba, enPruebaVigente, tipoDeCuenta } from '@/domain/planes'
import { cn } from '@/lib/cn'
import { claveOnboarding, guiaPara, marcarOnboardingVisto, onboardingVisto, type GuiaInicial, type IconoGuia } from '../lib/onboarding'

const ICONOS: Record<IconoGuia, LucideIcon> = {
  bienvenida: PartyPopper,
  equipo: Users,
  adultos: ClipboardList,
  visita: HeartHandshake,
  alerta: BellRing,
  sinConexion: WifiOff,
  plan: Gift,
  privacidad: Lock,
  emergencia: Siren,
  indicaciones: Pill,
}

const FOCALIZABLES = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Presentación del diálogo: pasos, navegación, foco atrapado y Esc. `onTerminar` se llama al saltar, al empezar o con Esc. */
export function GuiaDialogo({ guia, onTerminar }: { guia: GuiaInicial; onTerminar: () => void }) {
  const [indice, setIndice] = useState(0)
  const dialogo = useRef<HTMLDivElement>(null)
  const titulo = useId()
  const texto = useId()
  const total = guia.pasos.length
  const paso = guia.pasos[indice]!
  const Icono = ICONOS[paso.icono]
  const ultimo = indice === total - 1

  // El efecto del teclado se monta una sola vez: siempre llama a la última versión de `onTerminar`.
  const alTerminar = useRef(onTerminar)
  useEffect(() => {
    alTerminar.current = onTerminar
  }, [onTerminar])
  const terminar = useCallback(() => alTerminar.current(), [])

  // Foco inicial, bloqueo del fondo, devolución del foco y teclado (Esc y Tab atrapado).
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    dialogo.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        terminar()
        return
      }
      if (e.key !== 'Tab' || !dialogo.current) return
      const items = Array.from(dialogo.current.querySelectorAll<HTMLElement>(FOCALIZABLES))
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const primero = items[0]!
      const final = items[items.length - 1]!
      const activo = document.activeElement
      if (e.shiftKey && (activo === primero || activo === dialogo.current)) {
        e.preventDefault()
        final.focus()
      } else if (!e.shiftKey && activo === final) {
        e.preventDefault()
        primero.focus()
      } else if (!dialogo.current.contains(activo)) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = overflow
      previo?.focus?.()
    }
  }, [terminar])

  return createPortal(
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-navy/55 animate-fade md:items-center md:p-6">
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo}
        aria-describedby={texto}
        tabIndex={-1}
        className="flex max-h-[92dvh] w-full flex-col gap-5 overflow-y-auto rounded-t-lg bg-bg px-5 pb-[max(20px,calc(var(--safe-bottom)+16px))] pt-6 shadow-2 outline-none animate-up motion-reduce:animate-none md:max-w-[520px] md:rounded-lg md:p-8 md:animate-pop"
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-muted">{guia.contexto}</p>
          <StepBar step={indice + 1} total={total} />
          <p className="text-sm font-semibold text-muted" aria-hidden>
            Paso {indice + 1} de {total}
          </p>
        </div>

        {/* El título y el texto se anuncian al cambiar de paso (el foco se queda en los botones). */}
        <div className="flex flex-col items-center gap-4 text-center" aria-live="polite">
          <span className={cn('grid size-20 place-items-center rounded-full', paso.icono === 'emergencia' ? 'bg-danger-100 text-danger' : 'bg-blue-100 text-navy')} aria-hidden>
            <Icono size={40} strokeWidth={1.8} />
          </span>
          <h2 id={titulo} className="text-balance text-2xl font-bold leading-tight text-navy">
            {paso.titulo}
          </h2>
          <p id={texto} className="text-pretty text-base leading-relaxed text-ink-2">
            {paso.texto}
          </p>
        </div>

        {/* El orden del DOM es el del foco: la acción principal primero, luego volver y, al final, saltar. */}
        <div className="mt-1 flex flex-col gap-2">
          <Button fullWidth onClick={() => (ultimo ? terminar() : setIndice((i) => i + 1))}>
            {ultimo ? (
              'Empezar'
            ) : (
              <span className="inline-flex items-center gap-2">
                Siguiente <ArrowRight size={20} aria-hidden />
              </span>
            )}
          </Button>
          {indice > 0 && (
            <Button variant="outline" fullWidth onClick={() => setIndice((i) => i - 1)} icon={<ArrowLeft size={20} aria-hidden />}>
              Anterior
            </Button>
          )}
          {!ultimo && (
            <Button variant="ghost" fullWidth onClick={terminar}>
              Saltar
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Guía de la primera vez, según el rol y la cuenta de la sesión. No muestra nada si no hay sesión o ya se vio. */
export function OnboardingInicial() {
  const { user, org } = useSession()
  const rol = user?.rol
  const userId = user?.id
  const clave = userId && rol ? claveOnboarding(userId, rol) : null
  // Claves cerradas en esta sesión (cubre el caso de un almacenamiento que no deja escribir).
  const [cerradas, setCerradas] = useState<ReadonlySet<string>>(() => new Set())

  const tipo = tipoDeCuenta(org)
  const nombreCuenta = org?.nombre
  const enPrueba = enPruebaVigente(org)
  const diasPrueba = diasRestantesPrueba(org)
  const guia = useMemo(
    () => (rol ? guiaPara({ rol, tipo, nombreCuenta, enPrueba, diasPrueba }) : null),
    [rol, tipo, nombreCuenta, enPrueba, diasPrueba],
  )

  const terminar = useCallback(() => {
    if (!clave) return
    marcarOnboardingVisto(clave)
    setCerradas((s) => new Set(s).add(clave))
  }, [clave])

  if (!clave || !guia || cerradas.has(clave) || onboardingVisto(clave)) return null
  return <GuiaDialogo key={clave} guia={guia} onTerminar={terminar} />
}

export default OnboardingInicial
