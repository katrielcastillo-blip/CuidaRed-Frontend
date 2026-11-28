/*
 * informe-medico.tsx — Informe médico por adulto mayor en el expediente conectado (fase 7, permiso `informe:exportar`:
 * Coordinador y Cuidador con alcance; el Administrador no). Pantalla completa (Figma 22): qué incluye el informe, aviso de
 * datos de salud y generación. Cada generación consulta el servidor una vez (queda auditada) y muestra lo que este devuelve,
 * con las secciones omitidas según los permisos; el PDF se arma con esos mismos datos.
 * Módulo: access-real (ID07).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useState, type ReactNode } from 'react'
import { Aviso, Badge, Button, Datum, Icono, RiesgoBadge } from '@/components/ui'
import { fechaCorta, fechaHora } from '@/domain/dates'
import { rutaInformeMedico, type InformeMedicoApi, type SeccionInforme } from '../api/reportes'
import { api, type RolCuenta } from '../client'
import { ROL_TEXTO } from '../cuentas-datos'
import { useConexionReal } from './controles'
import { Panel } from './expediente-ui'
import { MOTIVO_OMISION, nombreArchivoInforme, resumenOmitidas, SIN_PERMISO, vigenciaIndicacion } from './informe-medico-datos'
import { usePantallaSecundaria } from './marco/pantalla-secundaria'
import { mensajeReporte } from './reportes-errores'
import { ESTADO_GENERAL, hoyRD, textoRiesgo } from './reportes-modelo'
import { descargarBlob } from '@/features/gestion/lib/reportes-comun'
import type { OperacionProps } from './visitas'

const nombre = (p: { nombres: string; apellidos: string }) => `${p.nombres} ${p.apellidos}`.trim()
const ESTADO_EXPEDIENTE = { activo: 'Activo', inactivo: 'Inactivo', fallecido: 'Fallecido' }
const SEXO: Record<string, string> = { F: 'Femenino', M: 'Masculino' }
const CONTENIDO = [
  { titulo: 'Datos de identificación', detalle: 'Nombre, cédula, edad, sexo y ubicación' },
  { titulo: 'Indicaciones médicas vigentes', detalle: 'Tipo, frecuencia y desde cuándo' },
  { titulo: 'Riesgos vigentes e historial', detalle: 'Nivel actual y factores activos' },
  { titulo: 'Visitas recientes', detalle: 'Fecha, estado observado y responsable' },
]

/** Nota informativa (`role="note"`) con ícono: el color nunca es la única señal. */
function Nota({ tono, children, ...rest }: { tono: 'advertencia' | 'info' | 'neutra'; children: ReactNode; 'data-testid'?: string }) {
  const estilo = tono === 'advertencia' ? 'border-warning bg-warning-100 text-ink'
    : tono === 'info' ? 'border-navy bg-blue-100 font-semibold text-navy' : 'border-transparent bg-surface-2 text-ink-2'
  return <div role="note" className={`flex items-start gap-3 rounded-md border p-3 text-ayuda ${estilo}`} {...rest}>
    <Icono nombre={tono === 'advertencia' ? 'warning' : 'info'} tamano={20} className="mt-px flex-none" />
    <div className="min-w-0 flex-1 wrap-anywhere">{children}</div>
  </div>
}

function Omitida({ seccion }: { seccion: SeccionInforme }) {
  return <Nota tono="neutra">{MOTIVO_OMISION[seccion]}</Nota>
}

const TARJETA = 'grid grid-cols-1 gap-1 rounded-xl border border-surface-2 bg-surface p-3'
const TITULO_SECCION = 'text-tarjeta text-navy'

function Vista({ informe }: { informe: InformeMedicoApi }) {
  const { identificacion: id, riesgo, indicaciones, visitas } = informe
  const omitidas = informe.secciones_omitidas
  return <div className="grid grid-cols-1 gap-5">
    <p className="text-ayuda text-ink-2 wrap-anywhere">
      Generado el <time dateTime={informe.generado_en}>{fechaHora(informe.generado_en)}</time> por {nombre(informe.generado_por)} ({ROL_TEXTO[informe.generado_por.rol as RolCuenta] ?? informe.generado_por.rol}) · {informe.cuenta.nombre}.
      {' '}Constancia: <span className="break-all">{informe.informe_id}</span>
    </p>
    {omitidas.length > 0 && <Nota tono="advertencia" data-testid="secciones-omitidas">
      <b>Secciones omitidas según tus permisos:</b> {resumenOmitidas(omitidas)}.
    </Nota>}

    <section className="grid grid-cols-1 gap-3" aria-labelledby="informe-identificacion">
      <h4 id="informe-identificacion" className={TITULO_SECCION}>1. Datos de identificación</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Datum label="Nombre completo" value={nombre(id)} />
        <Datum label="Cédula" value={id.cedula ?? '—'} />
        <Datum label="Fecha de nacimiento" value={id.fecha_nacimiento ? `${fechaCorta(id.fecha_nacimiento)}${id.edad !== null ? ` (${id.edad} años)` : ''}` : '—'} />
        <Datum label="Sexo" value={id.sexo ? (SEXO[id.sexo] ?? id.sexo) : '—'} />
        <Datum label="Municipio" value={[id.municipio?.nombre, id.provincia?.nombre].filter(Boolean).join(', ') || '—'} />
        <Datum label="Estado del expediente" value={ESTADO_EXPEDIENTE[id.estado]} />
      </div>
    </section>

    <section className="grid grid-cols-1 gap-3" aria-labelledby="informe-indicaciones">
      <h4 id="informe-indicaciones" className={TITULO_SECCION}>2. Indicaciones médicas vigentes</h4>
      {!indicaciones ? <Omitida seccion="indicaciones" /> : <>
        {indicaciones.vigentes.length === 0 ? <p className="text-ayuda text-ink-2 wrap-anywhere">Sin indicaciones vigentes registradas.</p>
          : <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{indicaciones.vigentes.map((i) => <li key={i.indicacion_medica_id}>
            <div className={TARJETA}>
              <p className="font-semibold wrap-anywhere">{i.titulo} <span className="text-ayuda font-normal text-muted">· {i.tipo.nombre}</span></p>
              {i.descripcion && <p className="whitespace-pre-line text-ayuda text-ink-2 wrap-anywhere">{i.descripcion}</p>}
              <p className="text-ayuda text-muted wrap-anywhere">{[i.frecuencia_horario, vigenciaIndicacion(i.fecha_inicio, i.fecha_fin), i.registrada_por ? `Registrada por ${nombre(i.registrada_por)}` : null].filter(Boolean).join(' · ')}</p>
            </div>
          </li>)}</ul>}
        <p className="text-ayuda text-muted wrap-anywhere">{indicaciones.no_vigentes > 0 ? `No se incluyen ${indicaciones.no_vigentes} ${indicaciones.no_vigentes === 1 ? 'indicación' : 'indicaciones'} fuera de vigencia. ` : ''}Solo se transcribe lo indicado por personal de salud.</p>
      </>}
    </section>

    <section className="grid grid-cols-1 gap-3" aria-labelledby="informe-riesgo">
      <h4 id="informe-riesgo" className={TITULO_SECCION}>3. Riesgo vigente e historial</h4>
      {!riesgo ? <Omitida seccion="riesgo" /> : <>
        <div className="flex flex-wrap items-center gap-2"><span className="text-ayuda text-ink-2">Nivel vigente:</span>
          {riesgo.nivel_vigente ? <RiesgoBadge riesgo={riesgo.nivel_vigente} /> : <Badge>{textoRiesgo(null)}</Badge>}</div>
        {riesgo.vigentes.length === 0 ? <p className="text-ayuda text-ink-2 wrap-anywhere">Sin factores de riesgo vigentes.</p>
          : <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{riesgo.vigentes.map((r) => <li key={r.envejeciente_riesgo_id}>
            <div className={TARJETA}>
              <p className="font-semibold wrap-anywhere">{r.factor.nombre} · {r.nivel.nombre}</p>
              {(r.motivo || r.observacion) && <p className="text-ayuda text-ink-2 wrap-anywhere">{[r.motivo, r.observacion ? `Observación: ${r.observacion}` : null].filter(Boolean).join('. ')}</p>}
              <p className="text-ayuda text-muted wrap-anywhere">{fechaCorta(r.fecha)}</p>
            </div>
          </li>)}</ul>}
        {riesgo.historial.length > 0 && <div className="grid grid-cols-1 gap-2">
          <h5 className="text-cuerpo font-semibold">Historial de riesgos</h5>
          <div className="overflow-x-auto rounded-md border border-line-soft" tabIndex={0} role="region" aria-label="Historial de riesgos: desplázate horizontalmente si no ves todas las columnas">
            <table className="w-full text-ayuda">
              <thead className="bg-surface-2 text-left text-etiqueta uppercase text-ink-2"><tr>
                {['Fecha', 'Factor', 'Nivel', 'Estado', 'Motivo'].map((c) => <th key={c} scope="col" className="whitespace-nowrap px-3 py-2">{c}</th>)}
              </tr></thead>
              <tbody>{riesgo.historial.map((r) => <tr key={r.envejeciente_riesgo_id} className="border-t border-line-soft">
                <td className="whitespace-nowrap px-3 py-2">{fechaCorta(r.fecha)}</td><td className="px-3 py-2">{r.factor.nombre}</td>
                <td className="px-3 py-2">{r.nivel.nombre}</td><td className="px-3 py-2 capitalize">{r.estado}</td><td className="min-w-40 px-3 py-2">{r.motivo ?? '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
          {riesgo.historial_total > riesgo.historial.length && <p className="text-ayuda text-muted wrap-anywhere">Se muestran los {riesgo.historial.length} registros más recientes de {riesgo.historial_total}.</p>}
        </div>}
      </>}
    </section>

    <section className="grid grid-cols-1 gap-3" aria-labelledby="informe-visitas">
      <h4 id="informe-visitas" className={TITULO_SECCION}>4. Visitas recientes</h4>
      {!visitas ? <Omitida seccion="visitas" /> : <>
        {visitas.recientes.length === 0 ? <p className="text-ayuda text-ink-2 wrap-anywhere">Aún no hay visitas realizadas. Atención inicial pendiente.</p>
          : <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">{visitas.recientes.map((v) => <li key={v.visita_id}>
            <div className={TARJETA}>
              <p className="font-semibold wrap-anywhere">{fechaCorta(v.fecha)}{v.hora_inicio ? ` · ${v.hora_inicio}${v.hora_fin ? ` – ${v.hora_fin}` : ''}` : ''}
                <span className="text-ayuda font-normal text-muted"> · {v.estado_general ? (ESTADO_GENERAL[v.estado_general] ?? v.estado_general) : SIN_PERMISO}</span></p>
              <p className="text-ayuda text-ink-2 wrap-anywhere">{v.observacion ?? (v.estado_general === null ? SIN_PERMISO : 'Sin observaciones')}</p>
              <p className="text-ayuda text-muted wrap-anywhere">{v.responsables.length > 0 ? `Responsables: ${v.responsables.map(nombre).join(', ')}` : 'Sin responsables registrados'}</p>
            </div>
          </li>)}</ul>}
        <p className="text-ayuda text-muted wrap-anywhere">Última visita realizada: {visitas.ultima_fecha ? fechaCorta(visitas.ultima_fecha) : '—'} · {visitas.realizadas_total} {visitas.realizadas_total === 1 ? 'visita realizada' : 'visitas realizadas'} en total.</p>
      </>}
    </section>

    <Nota tono="info">
      {informe.aviso} Este informe resume información registrada por la red de cuidado comunitario y debe ser interpretado por personal de salud. Contiene datos sensibles: compártelo solo con quien corresponda.
    </Nota>
  </div>
}

export function InformeMedico({ base, token, cuenta, adultoId, nombreAdulto, volver }: Pick<OperacionProps, 'base' | 'token' | 'cuenta'> & {
  adultoId: string; nombreAdulto: string; volver: () => void
}) {
  const enLinea = useConexionReal()
  const [informe, setInforme] = useState<InformeMedicoApi>()
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string>()
  const permitido = cuenta.permisos.includes('informe:exportar')
  usePantallaSecundaria(permitido ? { titulo: 'Informe médico', volver } : null)
  // Sin `informe:exportar` (p. ej. el Administrador) no se ofrece: el servidor responde 403 de todos modos.
  if (!permitido) return null

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

  return <section className="grid grid-cols-1 gap-5" aria-label="Informe médico">
    <div className="grid max-w-form grid-cols-1 gap-5">
      <p className="text-seccion text-ink wrap-anywhere">{nombreAdulto}</p>
      <p className="-mt-2 text-cuerpo text-muted">Un resumen en PDF para llevar a una consulta médica. Incluye solo lo necesario.</p>
      <Panel className="py-1">
        {CONTENIDO.map((parte, indice) => <div key={parte.titulo} className="flex min-h-16 items-center gap-3 py-3">
          <span aria-hidden className="grid size-8 flex-none place-items-center rounded-full bg-blue-100 text-ayuda font-semibold text-blue-principal">{indice + 1}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-cuerpo font-bold text-ink wrap-anywhere">{parte.titulo}</span>
            <span className="text-ayuda text-muted wrap-anywhere">{parte.detalle}</span>
          </span>
          <Icono nombre="check_circle" tamano={24} className="flex-none text-teal" />
        </div>)}
      </Panel>
      <Nota tono="advertencia">Contiene datos de salud. Compártelo solo con el personal médico o la familia autorizada.</Nota>
      <div className="flex flex-col gap-3">
        {informe && <Button icon={<Icono nombre="picture_as_pdf" tamano={20} />} fullWidth onClick={descargar} loading={descargando}>Descargar informe en PDF</Button>}
        <Button variant={informe ? 'outline' : 'primary'} fullWidth icon={<Icono nombre="receipt_long" tamano={20} />} onClick={generar} loading={cargando} disabled={!enLinea}
          aria-describedby={enLinea ? undefined : 'informe-sin-conexion'}>{informe ? 'Generar de nuevo' : 'Generar informe médico'}</Button>
        {informe && <Button variant="ghost" onClick={() => { setInforme(undefined); setError(undefined) }}>Cerrar informe</Button>}
      </div>
      {!enLinea && <p id="informe-sin-conexion" className="text-ayuda text-muted">Sin conexión: el informe necesita Internet para quedar registrado en la auditoría.</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
    {informe && <div role="group" aria-label="Informe médico generado" className="grid grid-cols-1 gap-4 rounded-2xl border border-surface-2 bg-surface p-4 sm:p-5">
      <h3 className="text-seccion text-ink wrap-anywhere">Informe médico de {nombre(informe.identificacion)}</h3>
      <Vista informe={informe} />
    </div>}
  </section>
}
