/*
 * conectividad.ts — Estado de conexión del dispositivo (navigator.onLine + eventos online/offline).
 * Módulo: dominio · offline (SRS §11 "Transición de estados de conectividad", §13.2).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Además de la red real, permite "simular sin conexión" en esta pestaña (para demostraciones y pruebas
 * de campo sin apagar el Wi-Fi). La simulación se guarda en sessionStorage: cada pestaña actúa como un
 * dispositivo distinto.
 *
 * Los navegadores móviles pueden perder los eventos online/offline mientras la app está en segundo plano:
 * por eso el estado también se vuelve a leer de navigator.onLine al volver a la pestaña (visibilitychange,
 * pageshow y focus). Un cambio entre «sin red» y «con red» dispara a los suscriptores (p. ej. la sincronización).
 */
import { useSyncExternalStore } from 'react'

const CLAVE_SIMULACION = 'cuidared:simular-sin-conexion'
const listeners = new Set<() => void>()

function leerSimulacion() {
  try {
    return sessionStorage.getItem(CLAVE_SIMULACION) === '1'
  } catch {
    return false
  }
}

let simulado = typeof window !== 'undefined' ? leerSimulacion() : false
let redDisponible = typeof navigator !== 'undefined' ? navigator.onLine : true

const emitir = () => listeners.forEach((l) => l())

/** true si hay conexión con el "servidor central" (red disponible y sin simulación de desconexión). */
export const estaEnLinea = () => redDisponible && !simulado
export const simulandoSinConexion = () => simulado

export function setSimularSinConexion(valor: boolean) {
  simulado = valor
  try {
    if (valor) sessionStorage.setItem(CLAVE_SIMULACION, '1')
    else sessionStorage.removeItem(CLAVE_SIMULACION)
  } catch {
    /* sin sessionStorage: la simulación dura hasta recargar */
  }
  emitir()
}

export function suscribirConectividad(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Hook: true si hay conexión. Se actualiza al instante al perderla o recuperarla. */
export function useEnLinea(): boolean {
  return useSyncExternalStore(suscribirConectividad, estaEnLinea, estaEnLinea)
}

export function useSimulacionSinConexion(): boolean {
  return useSyncExternalStore(suscribirConectividad, simulandoSinConexion, simulandoSinConexion)
}

/** Vuelve a leer navigator.onLine y avisa solo si cambió. */
function releerRed() {
  const ahora = navigator.onLine
  if (ahora === redDisponible) return
  redDisponible = ahora
  emitir()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    redDisponible = true
    emitir()
  })
  window.addEventListener('offline', () => {
    redDisponible = false
    emitir()
  })
  window.addEventListener('focus', releerRed)
  window.addEventListener('pageshow', releerRed)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && releerRed())
}
