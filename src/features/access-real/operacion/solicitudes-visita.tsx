/* Bandeja de solicitudes compartida con Visitas. © 2026 Equipo CuidaRed – INTEC. */
import { useNavigate } from 'react-router-dom'
import { SolicitudesExternas } from './solicitudes-externas'
import type { OperacionProps } from './visitas'

export function SolicitudesVisita({ base,token,cuenta,usuarioId }:OperacionProps) {
 const navigate=useNavigate()
 const visitas='/operacion/'+encodeURIComponent(cuenta.cuenta_id)+'/visitas'
 return <section aria-label="Bandeja interna de solicitudes"><SolicitudesExternas base={base} token={token} usuarioId={usuarioId}
  volver={()=>navigate(visitas)} abrirVisita={id=>navigate(visitas+'?visita='+encodeURIComponent(id))}/></section>
}
