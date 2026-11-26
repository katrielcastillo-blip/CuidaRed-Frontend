/* Confirmación de la organización tras finalizar el horario; RF-02. © 2026 Equipo CuidaRed – INTEC. */
import { useState } from 'react'
import { Checkbox, SelectField } from '@/components/ui'
import { Estado, Formulario, Paginador, campo, usePagina } from './controles'
import type { AdultoNombre } from './visitas'

export function ConfirmarVisita({
  base,
  token,
  institucional,
  guardar,
  cancelar,
}: {
  base: string
  token: string
  institucional: boolean
  guardar: (datos: object) => Promise<void>
  cancelar: () => void
}) {
  const [resultado, setResultado] = useState('')
  const [ids, setIds] = useState<string[]>([])
  const adultos = usePagina<AdultoNombre>(
    institucional && resultado === 'realizada' ? base + '/envejecientes' : null,
    token,
    0,
    { filters: { estado: 'activo' } }
  )
  return (
    <Formulario
      titulo="Confirmar si la visita se realizó"
      campos={[
        {
          name: 'nota',
          label: resultado === 'no_realizada' ? 'Motivo por el que no se realizó' : 'Constancia de realización',
          type: 'textarea',
          min: 3,
          max: 600,
        },
      ]}
      accion="Guardar confirmación"
      tamanoAccion="sm"
      cancelar={cancelar}
      submitDisabled={!resultado}
      enviar={async (datos) => {
        await guardar({
          realizada: resultado === 'realizada',
          nota: campo(datos, 'nota'),
          ...(institucional && resultado === 'realizada' ? { envejeciente_ids: ids } : {}),
        })
      }}
    >
      <SelectField
        label="Resultado de la visita"
        value={resultado}
        required
        placeholder="Selecciona el resultado"
        options={[
          { value: 'realizada', label: 'Sí, se realizó' },
          { value: 'no_realizada', label: 'No se realizó' },
        ]}
        onChange={(e) => setResultado(e.target.value)}
      />
      <p className="rounded-sm bg-blue-100 p-3 text-sm text-ink-2">
        La confirmación queda registrada con tu usuario. Solo una visita realizada actualiza la última visita de las
        personas participantes.
      </p>
      {institucional && resultado === 'realizada' && (
        <fieldset className="grid min-w-0 gap-2 rounded-sm border border-line-soft p-3">
          <legend className="px-1 text-sm font-semibold">Personas mayores que participaron ({ids.length}/100)</legend>
          <p className="text-sm text-muted">
            Selecciona únicamente a quienes estuvieron presentes. Si la actividad no tuvo participantes identificados,
            se conserva como visita institucional sin modificar los expedientes.
          </p>
          <Estado consulta={adultos} />
          {adultos.datos?.data.map((a) => (
            <Checkbox
              key={a.envejeciente_id}
              label={a.nombres + ' ' + a.apellidos}
              checked={ids.includes(a.envejeciente_id)}
              disabled={ids.length >= 100 && !ids.includes(a.envejeciente_id)}
              onChange={() =>
                setIds((v) =>
                  v.includes(a.envejeciente_id) ? v.filter((x) => x !== a.envejeciente_id) : [...v, a.envejeciente_id]
                )
              }
            />
          ))}
          {adultos.datos && (
            <Paginador pagina={adultos.pagina} total={adultos.datos.meta.totalPages} cambiar={adultos.cambiar} />
          )}
        </fieldset>
      )}
    </Formulario>
  )
}
