/* Descarga el subconjunto oficial de Material Symbols y lo aloja localmente. © 2026 Equipo CuidaRed – INTEC. */
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const raiz = fileURLToPath(new URL('..', import.meta.url))
const catalogo = readFileSync(raiz + '/src/components/icons/catalogo.ts', 'utf8')
const nombres = [...new Set([...catalogo.matchAll(/'([a-z][a-z0-9_]+)'/g)].map(m => m[1]))].sort()
const url = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:FILL@0..1&icon_names=' + nombres.join(',') + '&display=block'
const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
if (!response.ok) throw new Error('No se pudo obtener el catálogo oficial: ' + response.status)
const css = await response.text()
const fuente = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1]
if (!fuente) throw new Error('La respuesta no incluyó la fuente oficial')
const asset = await fetch(fuente)
if (!asset.ok) throw new Error('No se pudo descargar la fuente: ' + asset.status)
const datos = new Uint8Array(await asset.arrayBuffer())
if (datos.length > 250000 || datos.length < 1000) throw new Error('El subconjunto no tiene el tamaño esperado')
mkdirSync(raiz + '/src/assets/fonts', { recursive: true })
writeFileSync(raiz + '/src/assets/fonts/material-symbols-cuidared.woff2', datos)
copyFileSync(raiz + '/node_modules/material-symbols/LICENSE', raiz + '/src/assets/fonts/MATERIAL-SYMBOLS-LICENSE.txt')
writeFileSync(raiz + '/src/assets/fonts/README.md', '# Iconos de CuidaRed\n\nMaterial Symbols Outlined de Google, autoalojado. Subconjunto de ' + nombres.length + ' iconos, peso 400 y FILL 0/1. Licencia Apache 2.0 adjunta.\n\nOrigen: [Guía oficial](https://developers.google.com/fonts/docs/material_symbols). Se regenera con `node scripts/preparar-iconos.mjs`; no se consulta Google Fonts al usar la PWA.\n')
console.log(JSON.stringify({ iconos: nombres.length, bytes: datos.length }))
