/*
 * proyecto.ts — Datos de identificación del producto (pantalla "Acerca de", pie de página, manifiesto).
 * Módulo: utilidades compartidas (SRS §18.1, §18.3, §18.5, §18.6).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export const PRODUCTO = {
  nombre: 'CuidaRed',
  lema: 'Seguimiento Comunitario',
  /** SemVer 2.0.0: el MVP académico se entrega como 1.0.0 (SRS §18.5). */
  version: '1.0.0',
  anio: 2026,
  equipo: 'Equipo CuidaRed – Equipo de Trabajo #5',
  /** Integrantes del equipo de desarrollo (orden alfabético por nombre). */
  integrantes: ['Edgardo Santos', 'Giselle Ventura', 'Katriel Castillo', 'Natasha Torres', 'Seline Feliz'],
  institucion: 'Instituto Tecnológico de Santo Domingo (INTEC)',
  curso: 'IDS352-01 Anteproyecto de Grado · Área de Ingenierías',
  copyright: '© 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.',
  descargo:
    'CuidaRed es una herramienta de coordinación y seguimiento comunitario. No sustituye servicios médicos, instituciones públicas ni organismos de emergencia. En una emergencia llama al 9-1-1.',
} as const
