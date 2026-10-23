/*
 * index.ts — Capa de servicios de CuidaRed: el "backend" local de esta versión solo frontend.
 * Toda escritura de las pantallas pasa por aquí: valida datos, comprueba rol y alcance (RBAC),
 * escribe en el servidor simulado (o en la cola offline) y deja rastro en auditoría.
 * Módulo: dominio · servicios.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export * from './comun'
export * from './adultos'
export * from './visitas'
export * from './necesidades'
export * from './alertas'
export * from './usuarios'
export * from './agenda'
export * from './cuenta'
