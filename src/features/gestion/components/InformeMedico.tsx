/*
 * InformeMedico.tsx — Botón «Exportar informe médico (PDF)» del perfil del adulto mayor. Visible solo con el
 * permiso informe:exportar sobre ese adulto (Coordinador y Cuidador de sus asignados; el Administrador, el
 * Familiar y el Voluntario no lo tienen). El permiso se vuelve a validar al pulsar (verificar() deja constancia
 * de los intentos denegados) y cada exportación queda en auditoría (auditarExportacion, entidad «adulto»), por
 * eso el botón se deshabilita sin conexión. El PDF lo genera lib/informeMedico.ts con jsPDF cargado bajo demanda.
 * Módulo: gestión (reutilizable por cualquier área).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { auditarExportacion, verificar } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { useEnLinea } from '@/domain/conectividad'
import { puede } from '@/domain/permisos'
import { getDB } from '@/domain/store'
import type { Adulto } from '@/domain/types'
import { cn } from '@/lib/cn'
import { generarInformeMedico } from '../lib/informeMedico'

export function BotonInformeMedico({ adulto, className }: { adulto: Adulto; className?: string }) {
  const user = useUser()
  const toast = useToast()
  const enLinea = useEnLinea()
  const [generando, setGenerando] = useState(false)

  // Sin informe:exportar sobre este adulto (o fuera de su alcance) no se ofrece la acción.
  if (!puede(user, 'informe:exportar', adulto)) return null

  const exportar = async () => {
    // Segunda validación en el momento de exportar: si falta permiso queda registrado el intento denegado.
    const denegado = verificar(user, 'informe:exportar', 'adulto', adulto, adulto.id)
    if (denegado && !denegado.ok) return toast(denegado.error, 'error')
    setGenerando(true)
    try {
      const db = getDB()
      const { doc, nombreArchivo } = await generarInformeMedico({
        adulto,
        generadoPor: user,
        cuenta: db.orgs.find((o) => o.id === adulto.orgId)?.nombre ?? '',
        db,
        verIndicaciones: puede(user, 'indicaciones:ver', adulto),
        verSensible: puede(user, 'adultos:ver-sensible', adulto),
      })
      doc.save(nombreArchivo)
      auditarExportacion(user, `Informe médico (PDF) del adulto ${adulto.id}`, 'adulto')
      toast('Informe médico generado: revisa tus descargas')
    } catch {
      toast('No se pudo generar el informe. Inténtalo de nuevo.', 'error')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button variant="light" icon={<FileDown size={20} aria-hidden />} onClick={exportar} loading={generando} disabled={!enLinea} aria-describedby={enLinea ? undefined : 'informe-sin-conexion'}>
        Exportar informe médico (PDF)
      </Button>
      {!enLinea && (
        <p id="informe-sin-conexion" className="text-xs text-muted">
          Sin conexión: la exportación necesita internet para quedar registrada en auditoría.
        </p>
      )}
    </div>
  )
}
