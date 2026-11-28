/*
 * generar-iconos.mjs — Genera src/components/ui/iconos-material.ts con los trazos de Material Symbols
 * Outlined (peso 400) que usa la app. Solo se empaquetan los íconos listados: nada de fuentes ni CDN.
 * Uso: añade el nombre a NOMBRES y ejecuta `npm run iconos`.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NOMBRES = [
  'add', 'category', 'add_a_photo', 'add_business', 'arrow_back', 'arrow_upward', 'assignment', 'badge', 'bar_chart',
  'calendar_month', 'call', 'check', 'check_box', 'check_box_outline_blank', 'check_circle', 'checklist',
  'chevron_left', 'chevron_right', 'close', 'cloud_done', 'cloud_off', 'cloud_sync', 'contact_emergency', 'credit_card',
  'diamond', 'directions_car', 'download', 'edit', 'elderly', 'error', 'event', 'fact_check', 'family_home',
  'format_list_numbered', 'group', 'help', 'history', 'home', 'image', 'inbox', 'info', 'key',
  'keyboard_arrow_down', 'keyboard_arrow_up', 'location_on', 'lock', 'lock_reset', 'login', 'logout', 'mail',
  'mark_email_read', 'medication', 'menu_book', 'monitoring', 'more_horiz', 'more_vert', 'notifications',
  'notifications_active', 'person', 'person_add', 'picture_as_pdf', 'play_circle', 'privacy_tip', 'quiz',
  'radio_button_unchecked', 'receipt_long', 'restaurant', 'schedule', 'search', 'sentiment_dissatisfied',
  'sentiment_neutral', 'sentiment_satisfied', 'settings', 'support_agent', 'swap_horiz', 'sync', 'table_view',
  'text_increase', 'thumb_down', 'thumb_up', 'translate', 'tune', 'visibility', 'visibility_off',
  'volunteer_activism', 'warning', 'wifi', 'wifi_off', 'send', 'radio_button_checked', 'sync_problem', 'pause_circle', 'cancel',
  'dark_mode', 'accessibility_new', 'light_mode', 'brightness_auto',
]

const require = createRequire(import.meta.url)
const carpeta = join(dirname(require.resolve('@material-symbols/svg-400/package.json')), 'outlined')
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')

const lineas = [...new Set(NOMBRES)].sort().map((nombre) => {
  const svg = readFileSync(join(carpeta, `${nombre}.svg`), 'utf8')
  const trazos = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
  if (!svg.includes('viewBox="0 -960 960 960"') || trazos.length === 0) throw new Error(`Formato inesperado en ${nombre}.svg`)
  return `  ${nombre}: '${trazos.join(' ')}',`
})

const salida = `/*
 * iconos-material.ts — ARCHIVO GENERADO por scripts/generar-iconos.mjs. No lo edites a mano.
 * Trazos de Material Symbols Outlined (peso 400, viewBox 0 -960 960 960). Licencia Apache 2.0 (Google).
 */
export const ICONOS = {
${lineas.join('\n')}
} as const

export type NombreIcono = keyof typeof ICONOS
`
writeFileSync(join(raiz, 'src/components/ui/iconos-material.ts'), salida)
console.log(`iconos-material.ts: ${lineas.length} íconos`)
