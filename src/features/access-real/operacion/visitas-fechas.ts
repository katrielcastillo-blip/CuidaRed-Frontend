/* Calendario operativo de CuidaRed en República Dominicana. © 2026 Equipo CuidaRed – INTEC. */
const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function fechaDominicana(desplazamiento = 0) {
  const partes = Object.fromEntries(formatoFecha.formatToParts(new Date()).map(({ type, value }) => [type, value]))
  const fecha = new Date(`${partes.year}-${partes.month}-${partes.day}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + desplazamiento)
  return fecha.toISOString().slice(0, 10)
}
