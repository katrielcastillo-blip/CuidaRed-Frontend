/*
 * Auditoria.tsx — Registro de auditoría de la organización (solo lectura): fecha y hora, usuario y rol,
 * operación, entidad y registro afectado, resultado y detalle. Filtros, paginación y exportación CSV.
 * Módulo: sistema · auditabilidad (SRS §8.2.2.1.3 · §8.2.2.3.4 e · §8.2.2.3.5 j). Ruta protegida con auditoria:ver.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, Lock, SlidersHorizontal } from 'lucide-react'
import { Button, EmptyState, SearchInput, SelectField, TextField, useToast } from '@/components/ui'
import { auditarExportacion } from '@/domain/api'
import { useUser } from '@/domain/auth'
import { fechaCorta, fechaHora, hora12, toISODate } from '@/domain/dates'
import { useDB } from '@/domain/store'
import type { EntidadAuditada, RegistroAuditoria, ResultadoAuditoria } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Page, useShell } from '@/layouts/AppShell'
import { ENTIDAD_TEXTO, operacionTexto, registroTexto, RESULTADO, ResultadoBadge, rolAuditoriaTexto } from '@/features/admin/components/AuditoriaUi'
import { normalizar } from '@/features/admin/lib/datos'

const POR_PAGINA = 25

interface Filtros {
  desde: string
  hasta: string
  usuario: string
  operacion: string
  entidad: string
  resultado: string
}
const VACIOS: Filtros = { desde: '', hasta: '', usuario: '', operacion: '', entidad: '', resultado: '' }

interface Fila {
  e: RegistroAuditoria
  operacion: string
  rol: string
  registro: string
}

const celdaCSV = (v: string) => `"${v.replace(/"/g, '""')}"`

export default function Auditoria() {
  const user = useUser()
  const { base } = useShell()
  const toast = useToast()
  const [params] = useSearchParams()
  const auditoria = useDB((s) => s.auditoria)
  const usuarios = useDB((s) => s.usuarios)
  const adultos = useDB((s) => s.adultos)
  const alertas = useDB((s) => s.alertas)
  const visitas = useDB((s) => s.visitas)
  const necesidades = useDB((s) => s.necesidades)
  const orgs = useDB((s) => s.orgs)

  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...VACIOS, usuario: params.get('usuario') ?? '' }))
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const [verFiltros, setVerFiltros] = useState(() => !!params.get('usuario'))

  // Entradas de la organización del administrador (incluye procesos automáticos del sistema de su org).
  const filas: Fila[] = useMemo(() => {
    const db = { usuarios, adultos, alertas, visitas, necesidades, orgs }
    return auditoria
      .filter((e) => e.orgId === user.orgId)
      .map((e) => ({ e, operacion: operacionTexto(e.accion), rol: rolAuditoriaTexto(e.rol), registro: registroTexto(e, db) }))
  }, [auditoria, usuarios, adultos, alertas, visitas, necesidades, orgs, user.orgId])

  const opcionesUsuario = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filas) if (!m.has(f.e.usuarioId)) m.set(f.e.usuarioId, `${f.e.usuarioNombre} (${f.rol})`)
    return [{ value: '', label: 'Todos los usuarios' }, ...[...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'))]
  }, [filas])
  const opcionesOperacion = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of filas) m.set(f.e.accion, f.operacion)
    return [{ value: '', label: 'Todas las operaciones' }, ...[...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'))]
  }, [filas])
  const opcionesEntidad = [{ value: '', label: 'Todas las entidades' }, ...(Object.keys(ENTIDAD_TEXTO) as EntidadAuditada[]).map((k) => ({ value: k, label: ENTIDAD_TEXTO[k] }))]
  const opcionesResultado = [{ value: '', label: 'Todos los resultados' }, ...(Object.keys(RESULTADO) as ResultadoAuditoria[]).map((k) => ({ value: k, label: RESULTADO[k].texto }))]

  const filtradas = useMemo(() => {
    const t = normalizar(q)
    return filas.filter(({ e, operacion, registro, rol }) => {
      const dia = toISODate(new Date(e.fecha))
      if (filtros.desde && dia < filtros.desde) return false
      if (filtros.hasta && dia > filtros.hasta) return false
      if (filtros.usuario && e.usuarioId !== filtros.usuario) return false
      if (filtros.operacion && e.accion !== filtros.operacion) return false
      if (filtros.entidad && e.entidad !== filtros.entidad) return false
      if (filtros.resultado && e.resultado !== filtros.resultado) return false
      if (t && !normalizar(`${e.usuarioNombre} ${rol} ${operacion} ${registro} ${e.registroId ?? ''} ${e.detalle ?? ''}`).includes(t)) return false
      return true
    })
  }, [filas, filtros, q])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const pag = Math.min(pagina, totalPaginas)
  const visibles = filtradas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  const activos = Object.values(filtros).filter(Boolean).length

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => {
    setFiltros((f) => ({ ...f, [k]: v }))
    setPagina(1)
  }
  const limpiar = () => {
    setFiltros(VACIOS)
    setQ('')
    setPagina(1)
  }

  const exportar = () => {
    const cab = ['Fecha y hora (UTC)', 'Fecha y hora local', 'Usuario', 'Rol', 'Operación', 'Código', 'Entidad', 'Registro afectado', 'ID del registro', 'Resultado', 'Detalle']
    const lineas = filtradas.map(({ e, operacion, rol, registro }) =>
      [e.fecha, fechaHora(e.fecha), e.usuarioNombre, rol, operacion, e.accion, ENTIDAD_TEXTO[e.entidad], registro, e.registroId ?? '', RESULTADO[e.resultado].texto, e.detalle ?? '']
        .map(celdaCSV)
        .join(','),
    )
    const csv = '﻿' + [cab.map(celdaCSV).join(','), ...lineas].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria-cuidared-${toISODate(new Date())}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    auditarExportacion(user, `Registro de auditoría: ${filtradas.length} entradas (CSV)`, 'sesion')
    toast(`Exportadas ${filtradas.length} entradas a CSV`)
  }

  return (
    <Page title="Registro de auditoría" back={`${base}/mas`} wide>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">Registro de auditoría</h2>
        <p className="text-muted">Quién realizó cada operación, cuándo, sobre qué registro y con qué resultado.</p>
      </header>

      <div className="flex items-start gap-3 p-4 rounded-md border border-navy bg-blue-100 text-ink" role="note">
        <Lock size={20} className="flex-none mt-0.5 text-navy" aria-hidden />
        <p className="text-sm leading-relaxed">
          <strong>Registro de solo lectura: las entradas no pueden modificarse ni eliminarse.</strong> No se guardan contraseñas ni información clínica. Solo el
          administrador puede consultarlo.
        </p>
      </div>

      {/* Barra: búsqueda, filtros, exportar */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <SearchInput
          className="md:flex-[1_1_320px] md:max-w-[480px]"
          placeholder="Buscar usuario, operación, registro o detalle..."
          aria-label="Buscar en el registro de auditoría"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPagina(1)
          }}
        />
        <div className="flex gap-2 md:ml-auto">
          <Button
            variant={activos ? 'light' : 'outline'}
            size="sm"
            className="flex-1 md:hidden border-navy!"
            icon={<SlidersHorizontal size={18} aria-hidden />}
            aria-expanded={verFiltros}
            aria-controls="filtros-auditoria"
            onClick={() => setVerFiltros((v) => !v)}
          >
            Filtros{activos ? ` (${activos})` : ''}
          </Button>
          <Button size="sm" className="flex-1" icon={<Download size={18} aria-hidden />} disabled={filtradas.length === 0} onClick={exportar}>
            Exportar CSV
          </Button>
        </div>
      </div>

      <section
        id="filtros-auditoria"
        aria-label="Filtros"
        className={cn(verFiltros ? 'grid' : 'hidden', 'md:grid gap-4 p-4 rounded-md bg-surface shadow-1 sm:grid-cols-2 lg:grid-cols-3')}
      >
        <TextField label="Desde" type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => set('desde', e.target.value)} />
        <TextField label="Hasta" type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => set('hasta', e.target.value)} />
        <SelectField label="Usuario" value={filtros.usuario} options={opcionesUsuario} onChange={(e) => set('usuario', e.target.value)} />
        <SelectField label="Operación" value={filtros.operacion} options={opcionesOperacion} onChange={(e) => set('operacion', e.target.value)} />
        <SelectField label="Entidad" value={filtros.entidad} options={opcionesEntidad} onChange={(e) => set('entidad', e.target.value)} />
        <SelectField
          label="Resultado"
          value={filtros.resultado}
          options={opcionesResultado}
          help="Éxito: la operación se completó. Fallo: no se completó (p. ej. contraseña incorrecta). Denegado: el rol no tenía permiso. Conflicto: dos versiones del mismo registro se resolvieron al sincronizar."
          onChange={(e) => set('resultado', e.target.value)}
        />
        {(activos > 0 || q) && (
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <Button variant="ghost" onClick={limpiar}>
              Limpiar filtros
            </Button>
          </div>
        )}
      </section>

      <p className="-mt-2 text-sm text-muted" aria-live="polite">
        {filtradas.length} {filtradas.length === 1 ? 'entrada' : 'entradas'}
        {filtradas.length !== filas.length ? ` de ${filas.length}` : ''}
        {filtradas.length > 0 && ` · mostrando ${(pag - 1) * POR_PAGINA + 1}–${Math.min(pag * POR_PAGINA, filtradas.length)}`}
      </p>

      {filtradas.length === 0 ? (
        <EmptyState
          title="Sin entradas"
          text={filas.length === 0 ? 'Aún no hay operaciones registradas.' : 'Ninguna entrada coincide con los filtros.'}
          action={
            filas.length > 0 && (
              <Button variant="light" size="sm" onClick={limpiar}>
                Limpiar filtros
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Móvil y tablet: tarjetas */}
          <ol className="flex flex-col gap-3 lg:hidden">
            {visibles.map(({ e, operacion, rol, registro }) => (
              <li key={e.id} className="flex flex-col gap-2 p-4 rounded-md bg-surface shadow-1">
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-base text-ink">{operacion}</strong>
                  <ResultadoBadge resultado={e.resultado} className="flex-none mt-0.5" />
                </div>
                <time dateTime={e.fecha} className="text-sm text-muted">
                  {fechaHora(e.fecha)}
                </time>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Usuario</dt>
                  <dd className="text-ink wrap-anywhere">
                    {e.usuarioNombre} <span className="text-muted">· {rol}</span>
                  </dd>
                  <dt className="text-muted">{ENTIDAD_TEXTO[e.entidad]}</dt>
                  <dd className="text-ink wrap-anywhere">{registro}</dd>
                  {e.detalle && (
                    <>
                      <dt className="text-muted">Detalle</dt>
                      <dd className="text-ink-2 wrap-anywhere">{e.detalle}</dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ol>

          {/* Escritorio: tabla */}
          <div className="hidden lg:block rounded-md bg-surface shadow-1 overflow-hidden">
            <table className="w-full border-collapse text-sm table-fixed">
              <caption className="sr-only">Registro de auditoría, página {pag} de {totalPaginas}</caption>
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[21%]" />
                <col className="w-[11%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="bg-navy text-white text-left">
                  <th scope="col" className="px-3 py-3 font-semibold">Fecha y hora</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Usuario</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Operación</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Registro afectado</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Resultado</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ e, operacion, rol, registro }) => (
                  <tr key={e.id} className="border-t border-line-soft align-top even:bg-bg">
                    <td className="px-3 py-2.5 text-ink-2">
                      <time dateTime={e.fecha} className="flex flex-col">
                        <span className="text-ink">{fechaCorta(e.fecha)}</span>
                        <span className="text-xs">{hora12(e.fecha)}</span>
                      </time>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block font-semibold text-ink wrap-anywhere">{e.usuarioNombre}</span>
                      <span className="block text-xs text-muted">{rol}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink">{operacion}</td>
                    <td className="px-3 py-2.5">
                      <span className="block text-xs text-muted">{ENTIDAD_TEXTO[e.entidad]}</span>
                      <span className="block text-ink wrap-anywhere">{registro}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <ResultadoBadge resultado={e.resultado} />
                    </td>
                    <td className="px-3 py-2.5 text-ink-2 wrap-anywhere">{e.detalle ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <nav className="flex items-center justify-between gap-3" aria-label="Paginación">
              <Button variant="outline" className="border-navy!" size="sm" icon={<ChevronLeft size={18} aria-hidden />} disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>
                Anterior
              </Button>
              <span className="text-sm font-semibold text-ink-2" aria-current="page">
                Página {pag} de {totalPaginas}
              </span>
              <Button variant="outline" className="border-navy!" size="sm" disabled={pag >= totalPaginas} onClick={() => setPagina(pag + 1)}>
                Siguiente <ChevronRight size={18} aria-hidden className="inline -mr-1" />
              </Button>
            </nav>
          )}
        </>
      )}
    </Page>
  )
}
