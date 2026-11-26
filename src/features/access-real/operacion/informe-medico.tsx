/*
 * informe-medico.tsx — Informe médico por adulto mayor en el expediente conectado (fase 7, permiso `informe:exportar`:
 * Coordinador y Cuidador con alcance; el Administrador no). Cada generación consulta el servidor una vez (queda auditada)
 * y muestra lo que este devuelve, con las secciones omitidas según los permisos; el PDF se arma con esos mismos datos.
 * Módulo: access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState } from 'react'
import { FileDown, FileHeart } from '@/components/icons'
import { Badge, Button, Card, Datum, RiesgoBadge } from '@/components/ui'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { rutaInformeMedico, type InformeMedicoApi, type SeccionInforme } from '../api/reportes'
import { api, type RolCuenta } from '../client'
import { ROL_TEXTO } from '../cuentas-datos'
import { useConexionReal } from './controles'
import { MOTIVO_OMISION, nombreArchivoInforme, resumenOmitidas, SIN_PERMISO, vigenciaIndicacion } from './informe-medico-datos'
import { mensajeReporte } from './reportes-errores'
import { ESTADO_GENERAL, hoyRD, textoRiesgo } from './reportes-modelo'
import { descargarBlob } from '@/features/gestion/lib/reportes-comun'
import type { OperacionProps } from './visitas'

const nombre = (p: { nombres: string; apellidos: string }) => `${p.nombres} ${p.apellidos}`.trim()
const ESTADO_EXPEDIENTE = { activo: 'Activo', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const SEXO: Record<string, string> = { F: 'Femenino', M: 'Masculino' }

function Omitida({ seccion }: { seccion: SeccionInforme }) {
  return <p role="note" className="rounded-md bg-surface-2 p-3 text-sm text-ink-2">{MOTIVO_OMISION[seccion]}</p>
}

function Vista({ informe }: { informe: InformeMedicoApi }) {
  const { identificacion: id, riesgo, indicaciones, visitas } = informe
  const omitidas = informe.secciones_omitidas
  return <div className="grid gap-4">
    <p className="text-sm text-ink-2">
      Generado el <time dateTime={informe.generado_en}>{fechaHora(informe.generado_en)}</time> por {nombre(informe.generado_por)} ({ROL_TEXTO[informe.generado_por.rol as RolCuenta] ?? informe.generado_por.rol}) · {informe.cuenta.nombre}.
      {' '}Constancia: <span className="break-all">{informe.informe_id}</span>
    </p>
    {omitidas.length > 0 && <p role="note" className="rounded-md bg-warning-100 p-3 text-sm text-ink" data-testid="secciones-omitidas">
      <b>Secciones omitidas según tus permisos:</b> {resumenOmitidas(omitidas)}.
    </p>}

    <section className="grid gap-3" aria-labelledby="informe-identificacion">
      <h4 id="informe-identificacion" className="font-semibold text-navy">1. Datos de identificación</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <Datum label="Nombre completo" value={nombre(id)} />
        <Datum label="Cédula" value={id.cedula ?? '—'} />
        <Datum label="Fecha de nacimiento" value={id.fecha_nacimiento ? `${fechaCorta(id.fecha_nacimiento)}${id.edad !== null ? ` (${id.edad} años)` : ''}` : '—'} />
        <Datum label="Sexo" value={id.sexo ? (SEXO[id.sexo] ?? id.sexo) : '—'} />
        <Datum label="Municipio" value={[id.municipio?.nombre, id.provincia?.nombre].filter(Boolean).join(', ') || '—'} />
        <Datum label="Estado del expediente" value={ESTADO_EXPEDIENTE[id.estado]} />
      </div>
    </section>

    <section className="grid gap-3" aria-labelledby="informe-indicaciones">
      <h4 id="informe-indicaciones" className="font-semibold text-navy">2. Indicaciones médicas vigentes</h4>
      {!indicaciones ? <Omitida seccion="indicaciones" /> : <>
        {indicaciones.vigentes.length === 0 ? <p className="text-sm text-ink-2">Sin indicaciones vigentes registradas.</p>
          : <ul className="grid gap-2">{indicaciones.vigentes.map((i) => <li key={i.indicacion_medica_id}>
            <Card className="grid gap-1">
              <p className="font-semibold wrap-anywhere">{i.titulo} <span className="text-sm font-normal text-muted">· {i.tipo.nombre}</span></p>
              {i.descripcion && <p className="text-sm text-ink-2 whitespace-pre-line wrap-anywhere">{i.descripcion}</p>}
              <p className="text-xs text-muted">{[i.frecuencia_horario, vigenciaIndicacion(i.fecha_inicio, i.fecha_fin), i.registrada_por ? `Registrada por ${nombre(i.registrada_por)}` : null].filter(Boolean).join(' · ')}</p>
            </Card>
          </li>)}</ul>}
        <p className="text-xs text-muted">{indicaciones.no_vigentes > 0 ? `No se incluyen ${indicaciones.no_vigentes} ${indicaciones.no_vigentes === 1 ? 'indicación' : 'indicaciones'} fuera de vigencia. ` : ''}Solo se transcribe lo indicado por personal de salud.</p>
      </>}
    </section>

    <section className="grid gap-3" aria-labelledby="informe-riesgo">
      <h4 id="informe-riesgo" className="font-semibold text-navy">3. Riesgo vigente e historial</h4>
      {!riesgo ? <Omitida seccion="riesgo" /> : <>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-ink-2">Nivel vigente:</span>
          {riesgo.nivel_vigente ? <RiesgoBadge riesgo={riesgo.nivel_vigente} /> : <Badge>{textoRiesgo(null)}</Badge>}</div>
        {riesgo.vigentes.length === 0 ? <p className="text-sm text-ink-2">Sin factores de riesgo vigentes.</p>
          : <ul className="grid gap-2">{riesgo.vigentes.map((r) => <li key={r.envejeciente_riesgo_id}>
            <Card className="grid gap-1">
              <p className="font-semibold wrap-anywhere">{r.factor.nombre} · {r.nivel.nombre}</p>
              {(r.motivo || r.observacion) && <p className="text-sm text-ink-2 wrap-anywhere">{[r.motivo, r.observacion ? `Observación: ${r.observacion}` : null].filter(Boolean).join('. ')}</p>}
              <p className="text-xs text-muted">{fechaCorta(r.fecha)}</p>
            </Card>
          </li>)}</ul>}
        {riesgo.historial.length > 0 && <div className="grid gap-2">
          <h5 className="text-sm font-semibold">Historial de riesgos</h5>
          <div className="overflow-x-auto rounded-md border border-line-soft" tabIndex={0} role="region" aria-label="Historial de riesgos: desplázate horizontalmente si no ves todas las columnas">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-2"><tr>
                {['Fecha', 'Factor', 'Nivel', 'Estado', 'Motivo'].map((c) => <th key={c} scope="col" className="whitespace-nowrap px-3 py-2">{c}</th>)}
              </tr></thead>
              <tbody>{riesgo.historial.map((r) => <tr key={r.envejeciente_riesgo_id} className="border-t border-line-soft">
                <td className="whitespace-nowrap px-3 py-2">{fechaCorta(r.fecha)}</td><td className="px-3 py-2">{r.factor.nombre}</td>
                <td className="px-3 py-2">{r.nivel.nombre}</td><td className="px-3 py-2 capitalize">{r.estado}</td><td className="min-w-40 px-3 py-2">{r.motivo ?? '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {riesgo.historial_total > riesgo.historial.length && <p className="text-xs text-muted">Se muestran los {riesgo.historial.length} registros más recientes de {riesgo.historial_total}.</p>}
        </div>}
      </>}
    </section>

    <section className="grid gap-3" aria-labelledby="informe-visitas">
      <h4 id="informe-visitas" className="font-semibold text-navy">4. Visitas recientes</h4>
      {!visitas ? <Omitida seccion="visitas" /> : <>
        {visitas.recientes.length === 0 ? <p className="text-sm text-ink-2">Aún no hay visitas realizadas. Atención inicial pendiente.</p>
          : <ul className="grid gap-2">{visitas.recientes.map((v) => <li key={v.visita_id}>
            <Card className="grid gap-1">
              <p className="font-semibold">{fechaCorta(v.fecha)}{v.hora_inicio ? ` · ${v.hora_inicio}${v.hora_fin ? ` – ${v.hora_fin}` : ''}` : ''}
                <span className="text-sm font-normal text-muted"> · {v.estado_general ? (ESTADO_GENERAL[v.estado_general] ?? v.estado_general) : SIN_PERMISO}</span></p>
              <p className="text-sm text-ink-2 wrap-anywhere">{v.observacion ?? (v.estado_general === null ? SIN_PERMISO : 'Sin observaciones')}</p>
              <p className="text-xs text-muted">{v.responsables.length > 0 ? `Responsables: ${v.responsables.map(nombre).join(', ')}` : 'Sin responsables registrados'}</p>
            </Card>
          </li>)}</ul>}
        <p className="text-xs text-muted">Última visita realizada: {visitas.ultima_fecha ? fechaCorta(visitas.ultima_fecha) : '—'} · {visitas.realizadas_total} {visitas.realizadas_total === 1 ? 'visita realizada' : 'visitas realizadas'} en total.</p>
      </>}
    </section>

    <p role="note" className="rounded-md border border-navy bg-blue-100 p-3 text-sm font-semibold text-navy">
      {informe.aviso} Este informe resume información registrada por la red de cuidado comunitario y debe ser interpretado por personal de salud. Contiene datos sensibles: compártelo solo con quien corresponda.
    </p>
  </div>
}

export function InformeMedico({ base, token, cuenta, adultoId }: Pick<OperacionProps, 'base' | 'token' | 'cuenta'> & { adultoId: string }) {
  const enLinea = useConexionReal()
  const [informe, setInforme] = useState<InformeMedicoApi>()
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string>()
  // Sin `informe:exportar` (p. ej. el Administrador) no se ofrece: el servidor responde 403 de todos modos.
  if (!cuenta.permisos.includes('informe:exportar')) return null

  const generar = async () => {
    setCargando(true)
    setError(undefined)
    try {
      setInforme(await api<InformeMedicoApi>(rutaInformeMedico(base, adultoId), token))
    } catch (fallo) {
      setInforme(undefined)
      setError(mensajeReporte(fallo, 'informe'))
    } finally {
      setCargando(false)
    }
  }
  const descargar = async () => {
    if (!informe) return
    setDescargando(true)
    setError(undefined)
    try {
      const { generarInformePdf } = await import('./informe-medico-pdf')
      const doc = await generarInformePdf(informe)
      descargarBlob(nombreArchivoInforme(informe.identificacion, hoyRD()), doc.output('blob'))
    } catch {
      setError('No se pudo generar el PDF del informe. Intenta de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  return <section className="grid gap-3" aria-label="Informe médico">
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="light" size="sm" icon={<FileHeart size={18} aria-hidden />} onClick={generar} loading={cargando} disabled={!enLinea}
        aria-describedby={enLinea ? undefined : 'informe-sin-conexion'}>{informe ? 'Generar de nuevo' : 'Generar informe médico'}</Button>
      {informe && <Button size="sm" icon={<FileDown size={18} aria-hidden />} onClick={descargar} loading={descargando}>Descargar informe en PDF</Button>}
      {informe && <Button variant="ghost" size="sm" onClick={() => { setInforme(undefined); setError(undefined) }}>Cerrar informe</Button>}
    </div>
    {!enLinea && <p id="informe-sin-conexion" className="text-xs text-muted">Sin conexión: el informe necesita Internet para quedar registrado en la auditoría.</p>}
    {error && <p role="alert" className="rounded-md bg-danger-100 p-3 text-danger-700">{error}</p>}
    {informe && <Card className="grid gap-3" aria-label="Informe médico generado">
      <h3 className="text-lg font-bold">Informe médico de {nombre(informe.identificacion)}</h3>
      <Vista informe={informe} />
    </Card>}
  </section>
}
