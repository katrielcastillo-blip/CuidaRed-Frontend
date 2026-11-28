/*
 * Icono.tsx — Ícono del sistema de diseño (Material Symbols Outlined, peso 400).
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Para añadir un ícono: agrégalo a NOMBRES en scripts/generar-iconos.mjs y ejecuta `npm run iconos`.
 */
import type { SVGProps } from 'react'
import { ICONOS, type NombreIcono } from './iconos-material'

export type { NombreIcono }

type IconoProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  nombre: NombreIcono
  /** Lado en px (por defecto 24, como en el Figma). */
  tamano?: number
  /** Texto para lectores de pantalla. Sin él, el ícono es decorativo (aria-hidden). */
  etiqueta?: string
}

export function Icono({ nombre, tamano = 24, etiqueta, ...rest }: IconoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={tamano}
      height={tamano}
      fill="currentColor"
      focusable="false"
      {...(etiqueta ? { role: 'img', 'aria-label': etiqueta } : { 'aria-hidden': true })}
      {...rest}
    >
      <path d={ICONOS[nombre]} />
    </svg>
  )
}
