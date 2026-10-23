// encabezados.mjs — Comprueba (y con --corregir añade) el encabezado estándar de los archivos fuente
// (SRS §18.2): nombre del archivo, propósito, módulo y aviso de copyright.
// Uso: node scripts/encabezados.mjs [--corregir]
// © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'

const COPY = '© 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.'
const corregir = process.argv.includes('--corregir')
const raices = ['src', 'tests', 'scripts']
const extra = ['vite.config.ts', 'tailwind.config.ts', 'playwright.config.ts']

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return archivos(p)
    return /\.(tsx?|mjs|css)$/.test(n) ? [p] : []
  })
}

function modulo(p) {
  const partes = relative('.', p).split(sep)
  if (partes[0] === 'src' && partes[1] === 'features') return partes[2]
  if (partes[0] === 'src' && partes[1] === 'domain') return partes[2] === 'api' ? 'dominio · servicios' : 'dominio'
  if (partes[0] === 'src' && partes[1] === 'components') return 'kit de componentes UI'
  if (partes[0] === 'src') return partes[1]?.replace(/\.\w+$/, '') ?? 'app'
  return partes[0]
}

/** Primera frase del primer comentario de documentación del archivo (si existe). */
function proposito(texto, nombre) {
  const m = /\/\*\*\s*\n?\s*\*?\s*([^\n*][^\n]*)/.exec(texto)
  const frase = m?.[1]?.replace(/\*\/.*$/, '').trim()
  return frase ? frase.replace(/\.$/, '') : `Módulo ${nombre.replace(/\.\w+$/, '')}`
}

let faltan = 0
for (const p of [...raices.flatMap(archivos), ...extra]) {
  const texto = readFileSync(p, 'utf8')
  if (texto.includes(COPY)) continue
  faltan++
  if (!corregir) {
    console.log(`✗ ${p}`)
    continue
  }
  const nombre = basename(p)
  const cabecera = p.endsWith('.mjs')
    ? `// ${nombre} — ${proposito(texto, nombre)}.\n// ${COPY}\n`
    : `/*\n * ${nombre} — ${proposito(texto, nombre)}.\n * Módulo: ${modulo(p)}.\n * ${COPY}\n */\n`
  writeFileSync(p, cabecera + texto)
  console.log(`+ ${p}`)
}
console.log(faltan ? `${faltan} archivo(s) ${corregir ? 'corregidos' : 'sin encabezado'}` : 'Todos los archivos tienen encabezado.')
if (faltan && !corregir) process.exitCode = 1
