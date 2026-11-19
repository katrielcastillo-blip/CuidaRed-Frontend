/* Candidatos para asignar visitas. © 2026 Equipo CuidaRed – INTEC. */
import type { Candidato } from './visitas'

export function responsablesVisita(candidatos: Candidato[] = []) {
  const disponibles = candidatos.filter(({ rol, cuidador_id }) => rol === 'voluntario' || (rol === 'cuidador' && !!cuidador_id))
  return { disponibles, faltanPerfiles: candidatos.some(({ rol, cuidador_id }) => rol === 'cuidador' && !cuidador_id) }
}

export const avisoPerfilCuidador = 'Para asignar a alguien que aún no tiene perfil de cuidador, complétalo en Cuenta → Perfiles globales de cuidadores.'
