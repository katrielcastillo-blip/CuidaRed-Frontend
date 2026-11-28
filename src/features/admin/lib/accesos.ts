/*
 * accesos.ts — Textos del acceso de cada rol a los adultos mayores (tabla Vinculo): el Familiar necesita permiso
 * explícito por adulto («familiar responsable»); el Cuidador y el Voluntario ven solo a quienes tienen asignados.
 * Administrador y Coordinador acceden a todos los adultos de la cuenta, por eso no tienen entrada aquí.
 * Módulo: admin (CU-13 · Reglas de Negocio V2 §Vínculo, §Familiar, §Voluntario).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { Accion } from '@/domain/permisos'
import type { Rol } from '@/domain/types'

export interface AccesoRol {
  /** Título de la sección y etiqueta del grupo de casillas. */
  titulo: string
  /** Pista bajo las casillas. */
  pista: string
  /** Texto de ayuda («?»). */
  ayuda: string
  /** Explicación visible en el perfil. */
  explicacion: string
  /** Texto cuando el miembro no tiene ningún adulto. */
  vacio: string
  /** Acción que autoriza a modificar estos accesos. */
  permiso: Accion
  guardar: string
}

export const ACCESO_POR_ROL: Partial<Record<Rol, AccesoRol>> = {
  familiar: {
    titulo: 'Adultos mayores que puede ver',
    pista: 'Solo verá a los adultos mayores marcados. Puedes cambiarlo cuando quieras.',
    ayuda: 'Por privacidad, el familiar solo consulta el seguimiento de los adultos mayores para los que tiene permiso explícito; no ve a otros adultos ni a los demás miembros de la cuenta.',
    explicacion: 'Sin autorización explícita el familiar no ve a ningún adulto mayor. Marca únicamente a quienes puede consultar.',
    vacio: 'Este familiar aún no tiene autorización: no puede ver a ningún adulto mayor.',
    permiso: 'familiares:autorizar',
    guardar: 'Guardar autorizaciones',
  },
  cuidador: {
    titulo: 'Adultos mayores asignados',
    pista: 'El cuidador solo ve y atiende a los adultos mayores que tiene asignados.',
    ayuda: 'Un cuidador registra visitas, necesidades e indicaciones médicas únicamente de los adultos mayores asignados a él.',
    explicacion: 'El cuidador solo ve y atiende a los adultos mayores que tiene asignados.',
    vacio: 'Este cuidador no tiene adultos mayores asignados.',
    permiso: 'adultos:asignar',
    guardar: 'Guardar asignaciones',
  },
  voluntario: {
    titulo: 'Adultos mayores asignados',
    pista: 'El voluntario solo registra visitas de los adultos mayores asignados.',
    ayuda: 'El voluntario ocasional registra la visita y su observación, sin plan propio ni información médica, y únicamente de los adultos mayores que tiene asignados.',
    explicacion: 'El voluntario ocasional registra visitas sin plan propio y solo de los adultos mayores asignados. Sin asignación no verá ninguno.',
    vacio: 'Este voluntario no tiene adultos mayores asignados: no podrá registrar visitas.',
    permiso: 'adultos:asignar',
    guardar: 'Guardar asignaciones',
  },
}
