/*
 * Bienvenida.tsx — "/": página de bienvenida pública (reemplaza a la pantalla de carga con el logosímbolo).
 * Conecta la presentación (BienvenidaPresentacion, sin store) con el formulario "Solicitar una visita" del
 * prototipo, que usa domain/api/solicitudes. Con sesión, `RedirectIfAuthed` (en routes.tsx) salta al inicio del rol.
 * Módulo: auth (feedback de PM · CREACIÓN DEL HOME PAGE / BIENVENIDA).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { crearSolicitudVisita, organizacionesPublicas } from '@/domain/api/solicitudes'
import { useDB } from '@/domain/store'
import { BienvenidaPresentacion } from '../components/BienvenidaPresentacion'
import { SolicitarVisita } from '../components/SolicitarVisita'

export default function Bienvenida() {
  const orgs = useDB((s) => s.orgs)
  // Solo organizaciones (las cuentas Familia no se listan por privacidad).
  const organizaciones = useMemo(() => organizacionesPublicas(orgs).map((o) => ({ id: o.id, nombre: o.nombre })), [orgs])

  return <BienvenidaPresentacion solicitudVisita={<SolicitarVisita organizaciones={organizaciones} enviar={crearSolicitudVisita} />} />
}
