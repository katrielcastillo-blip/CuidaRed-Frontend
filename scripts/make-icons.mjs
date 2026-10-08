// Genera los iconos PWA (PNG) a partir de un SVG de marca sencillo.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#0c3b6e"/>
<g transform="translate(${pad} ${pad}) scale(${(512 - pad * 2) / 512})">
<circle cx="256" cy="256" r="152" fill="none" stroke="#378add" stroke-width="40"/>
<circle cx="256" cy="208" r="48" fill="#fff"/>
<path d="M152 368c16-64 64-96 104-96s88 32 104 96" fill="#14a085"/>
<circle cx="368" cy="112" r="40" fill="#14a085"/>
</g></svg>`

mkdirSync('public/icons', { recursive: true })
const out = (name, size, pad) =>
  sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`public/icons/${name}`)
await Promise.all([
  out('icon-192.png', 192, 0),
  out('icon-512.png', 512, 0),
  out('icon-maskable-512.png', 512, 70),
  out('apple-touch-icon.png', 180, 0),
])
console.log('iconos generados')
