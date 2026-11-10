/*
 * InstalarApp.tsx — Instalación de CuidaRed como app (PWA): hook `useInstalarApp()` y botón «Instalar CuidaRed».
 * Módulo: PWA (RNF-5 · instalable en Android e iOS).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Cómo funciona:
 *  - Android / Chrome / Edge: el navegador lanza `beforeinstallprompt`. public/pwa-instalacion.js lo guarda en
 *    cuanto ocurre (antes de que exista esta pantalla) y aquí se usa para abrir el cuadro de instalación.
 *  - iPhone / iPad (Safari): no existe ese evento; se muestran las instrucciones «Compartir → Agregar a inicio».
 *  - Si la app ya está instalada (`display-mode: standalone` o `navigator.standalone`) no se muestra nada.
 *  - Navegadores sin instalación disponible (Firefox, Safari de escritorio…): tampoco se muestra nada.
 *
 * Uso:
 *   <InstalarApp />                          // tarjeta lista para colocar en cualquier pantalla o menú
 *   const { estado, instalar } = useInstalarApp()   // estado: 'instalable' | 'ios' | 'instalada' | 'no-disponible'
 */
import { useCallback, useId, useState, useSyncExternalStore } from 'react'
import { Download, Share, Smartphone, SquarePlus } from 'lucide-react'
import { avisar } from '@/domain/avisos'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/cn'

export type EstadoInstalacion = 'instalable' | 'ios' | 'instalada' | 'no-disponible'
export type ResultadoInstalacion = 'aceptada' | 'rechazada' | 'no-disponible'

/** Evento `beforeinstallprompt` (aún no está en lib.dom). */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>
}

type VentanaPWA = Window & { __cuidaredInstalar?: EventoInstalacion | null; __cuidaredInstalada?: boolean }

const enNavegador = typeof window !== 'undefined'
const ventana = () => window as VentanaPWA

/* ───────────── Estado compartido (se captura una vez para toda la app) ───────────── */
let diferido: EventoInstalacion | null = enNavegador ? (ventana().__cuidaredInstalar ?? null) : null
let instaladaAhora = enNavegador ? !!ventana().__cuidaredInstalada : false
const oyentes = new Set<() => void>()
const emitir = () => oyentes.forEach((l) => l())

/** ¿Se está ejecutando como app instalada (ventana propia, sin barra del navegador)? */
function estaInstalada() {
  if (instaladaAhora) return true
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true // iOS
  return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches)
}

/** iPhone, iPad (incluido iPadOS, que se presenta como Mac) e iPod. */
function esIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function calcular(): EstadoInstalacion {
  if (estaInstalada()) return 'instalada'
  if (diferido) return 'instalable'
  if (esIOS()) return 'ios'
  return 'no-disponible'
}

function suscribir(l: () => void) {
  oyentes.add(l)
  return () => {
    oyentes.delete(l)
  }
}

if (enNavegador) {
  // Respaldo: si public/pwa-instalacion.js no se cargó, el evento se captura aquí (solo si llega después de este módulo).
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    diferido = e as EventoInstalacion
    emitir()
  })
  window.addEventListener('cuidared:instalable', () => {
    diferido = ventana().__cuidaredInstalar ?? diferido
    emitir()
  })
  const alInstalar = () => {
    diferido = null
    instaladaAhora = true
    emitir()
  }
  window.addEventListener('appinstalled', alInstalar)
  window.addEventListener('cuidared:instalada', alInstalar)
}

/** Estado de la instalación y la acción para iniciarla. */
// El hook vive junto al componente que lo usa (así se importa desde un solo archivo).
// oxlint-disable-next-line react/only-export-components
export function useInstalarApp() {
  const estado = useSyncExternalStore<EstadoInstalacion>(suscribir, calcular, () => 'no-disponible')

  /** Abre el cuadro de instalación del navegador (solo en `estado === 'instalable'`). */
  const instalar = useCallback(async (): Promise<ResultadoInstalacion> => {
    const evento = diferido
    if (!evento) return 'no-disponible'
    // El evento solo sirve una vez: si el usuario rechaza, el navegador lanzará otro más adelante.
    diferido = null
    ventana().__cuidaredInstalar = null
    emitir()
    try {
      await evento.prompt()
      const { outcome } = await evento.userChoice
      if (outcome === 'accepted') {
        instaladaAhora = true
        emitir()
        return 'aceptada'
      }
      return 'rechazada'
    } catch {
      return 'no-disponible'
    }
  }, [])

  return { estado, puedeInstalar: estado === 'instalable', instalar }
}

/** Tarjeta con el botón «Instalar CuidaRed» (Android/Chrome) o las instrucciones de iOS. No muestra nada si ya está instalada. */
export function InstalarApp({ className }: { className?: string }) {
  const { estado, instalar } = useInstalarApp()
  const [instalando, setInstalando] = useState(false)
  const titulo = useId()
  if (estado === 'instalada' || estado === 'no-disponible') return null

  const alPulsar = async () => {
    setInstalando(true)
    const r = await instalar()
    setInstalando(false)
    if (r === 'aceptada') avisar('CuidaRed se instaló. La encontrarás en la pantalla de inicio de tu dispositivo.', 'ok')
    else if (r === 'no-disponible') avisar('No se pudo abrir la instalación. Usa el menú del navegador y elige «Instalar aplicación».', 'error')
  }

  return (
    <Card tone="info" className={cn('flex flex-col gap-3', className)} role="region" aria-labelledby={titulo} data-testid="instalar-app">
      <div className="flex items-start gap-3">
        <Smartphone size={28} className="text-navy flex-none mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <h2 id={titulo} className="font-bold text-lg leading-tight">
            Instala CuidaRed en tu dispositivo
          </h2>
          <p className="text-sm text-ink-2">Ábrela desde la pantalla de inicio, como cualquier app, y úsala también sin conexión.</p>
        </div>
      </div>

      {estado === 'instalable' ? (
        <Button fullWidth icon={<Download size={20} aria-hidden />} loading={instalando} onClick={() => void alPulsar()}>
          Instalar CuidaRed
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">En iPhone y iPad: Compartir → Agregar a inicio</p>
          <ol className="flex flex-col gap-2 text-sm text-ink-2">
            <li className="flex items-center gap-3 min-h-12">
              <span className="grid place-items-center size-8 flex-none rounded-pill bg-navy text-white font-bold" aria-hidden>
                1
              </span>
              <span className="flex-1">
                Toca el botón <strong>Compartir</strong> <Share size={16} className="inline align-text-bottom" aria-hidden /> de Safari (barra inferior o superior).
              </span>
            </li>
            <li className="flex items-center gap-3 min-h-12">
              <span className="grid place-items-center size-8 flex-none rounded-pill bg-navy text-white font-bold" aria-hidden>
                2
              </span>
              <span className="flex-1">
                Elige <strong>Agregar a inicio</strong> <SquarePlus size={16} className="inline align-text-bottom" aria-hidden />. Si no lo ves, desliza hacia arriba la lista de opciones.
              </span>
            </li>
            <li className="flex items-center gap-3 min-h-12">
              <span className="grid place-items-center size-8 flex-none rounded-pill bg-navy text-white font-bold" aria-hidden>
                3
              </span>
              <span className="flex-1">
                Confirma con <strong>Agregar</strong>. CuidaRed aparecerá en tu pantalla de inicio.
              </span>
            </li>
          </ol>
        </div>
      )}
    </Card>
  )
}
