/*
 * portal.tsx — Navegación operativa por cuenta, con autorización consultada al servidor.
 * El marco (barras, menú, ayuda flotante, notificaciones y conexión) vive en ./marco; aquí se decide qué pantalla
 * es principal (barra superior + barra inferior + ayuda) y cuál secundaria (volver + título).
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { PantallaMiembros } from '../miembros'
import { datosCuentaAparte, puedeConsultarSuscripcion, recibeAvisosDeAlertas, tienePanelGestion } from '../cuentas-datos'
import { logout, type CuentaMe } from '../client'
import { Agenda } from './agenda'
import { Alertas } from './alertas'
import { AuditoriaCuenta } from './auditoria'
import type { ColaOperaciones } from './cola-operaciones'
import { Estado, idRuta, useConexionReal, useDatos, usePagina } from './controles'
import { Envejecientes } from './envejecientes'
import { GestionCuenta } from './gestion-cuenta'
import { Inicio } from './inicio'
import { AyudaFlotante } from './marco/ayuda'
import { BarraSecundaria, BarraSuperior, CabeceraEscritorio, EnlaceVolver, type DatosCabecera } from './marco/barras'
import { PantallaConexion } from './marco/conexion'
import { BarraInferior, HojaMas, MenuLateral } from './marco/menu'
import { esPantallaMarco, idsPestanas, mas, PANTALLAS_MARCO, repartirModulos, secciones } from './marco/modulos'
import { ContextoPantallaSecundaria, type PantallaSecundaria } from './marco/pantalla-secundaria'
import { PantallaNotificaciones } from './marco/notificaciones'
import { PantallaAccesibilidad, PantallaAprende, PantallaIdioma, PantallaPreguntas, PantallaSoporte, PantallaTema } from './marco/pantallas-ayuda'
import { Necesidades } from './necesidades'
import { Reportes } from './reportes'
import { ResumenCasos } from './resumen-casos'
import { SolicitudesVisita } from './solicitudes-visita'
import { SuscripcionCuenta } from './suscripcion'
import { Visitas } from './visitas'

export function Portal({ token, usuarioId, nombreUsuario = '', cola }: { token: string; usuarioId: string; nombreUsuario?: string; cola: ColaOperaciones }) {
  const { cuentaId, seccion = 'cuenta' } = useParams()
  const { key: navegacion } = useLocation()
  const navigate = useNavigate()
  const [revision, setRevision] = useState(0)
  const [masLocal, setMasLocal] = useState(false)
  // Subvista de un módulo (detalle o formulario) que pide Barra secundaria: ver marco/pantalla-secundaria.tsx.
  const [subvista, fijarSubvista] = useState<PantallaSecundaria | null>(null)
  const actualizarContexto = useCallback(() => setRevision((n) => n + 1), [])
  const enLinea = useConexionReal()
  const contenido = useRef<HTMLElement>(null)
  const masRef = useRef<HTMLButtonElement>(null)
  const base = cuentaId && /^[1-9][0-9]{0,18}$/.test(cuentaId) ? `/cuentas/${idRuta(cuentaId)}` : null
  const raiz = `/operacion/${idRuta(cuentaId ?? '')}`
  const contexto = useDatos<CuentaMe>(base ? `${base}/contexto` : null, token, revision)
  useEffect(() => {
    const actualizar = () => { if (document.visibilityState === 'visible') setRevision((n) => n + 1) }
    const timer = window.setInterval(actualizar, 30_000)
    window.addEventListener('focus', actualizar)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', actualizar)
    }
  }, [])
  const seccionAnterior = useRef(seccion)
  useEffect(() => {
    window.scrollTo(0, 0)
    // La hoja «Más» (ruta /mas) toma el foco al abrir y lo devuelve al botón Más al cerrar.
    const deLaHoja = seccion === 'mas' || seccionAnterior.current === 'mas'
    seccionAnterior.current = seccion
    if (!deLaHoja) contenido.current?.focus({ preventScroll: true })
  }, [cuentaId, seccion])
  const cuenta = contexto.datos
  const visible = secciones.filter((modulo) =>
    (!modulo.soloOrganizacion || cuenta?.tipo === 'organizacion') &&
    (!modulo.permiso || (cuenta?.acceso_operativo === true && cuenta.permisos.includes(modulo.permiso))))
  // La campana solo se muestra a quien recibe avisos de alertas (ver `recibeAvisosDeAlertas`); el resto tendría un contador siempre en cero.
  const recibeAvisos = !!cuenta && recibeAvisosDeAlertas(cuenta) && visible.some((modulo) => modulo.id === 'alertas')
  const pantalla = esPantallaMarco(seccion) && (seccion !== 'notificaciones' || recibeAvisos) ? seccion : undefined
  const actual: { id: string; titulo: string } | undefined = pantalla ? { id: pantalla, titulo: PANTALLAS_MARCO[pantalla] }
    : [...visible, mas].find((modulo) => modulo.id === seccion)
  const suscripcion = seccion === 'suscripcion' && puedeConsultarSuscripcion(cuenta)
  // «Datos de cuenta»: pantalla secundaria (como la suscripción) para quien tiene panel de gestión pero no puede abrir Configuración.
  const datosCuenta = seccion === 'datos-cuenta' && !!cuenta && datosCuentaAparte(cuenta)
  const mostrarAvisos = recibeAvisos && actual?.id !== 'miembros'
  const avisos = usePagina<unknown>(base && mostrarAvisos ? `${base}/notificaciones-alerta` : null, token, revision,
    { limit: 1, filters: { estado: 'no_leida' } })
  const pendientes = avisos.datos?.meta.total ?? 0
  const props = cuenta && base ? { base, token, cuenta, usuarioId } : undefined

  // Pantallas principales: pestañas de la barra inferior (y «Más»). El resto es secundaria: volver + título.
  const { pestanas, adicionales } = cuenta ? repartirModulos(cuenta.rol, visible) : { pestanas: [], adicionales: [] }
  const idsPrincipales = cuenta ? idsPestanas(cuenta.rol) : ['cuenta']
  const principal = !subvista && !pantalla && !suscripcion && (seccion === 'mas' || (!!actual && idsPrincipales.includes(actual.id)))
  const vista = actual?.id === 'mas' ? 'cuenta' : actual?.id
  const masAbierto = !!cuenta && (seccion === 'mas' || masLocal)
  const cerrarMas = useCallback(() => {
    setMasLocal(false)
    if (seccion === 'mas') navigate(`${raiz}/cuenta`, { replace: true })
    requestAnimationFrame(() => masRef.current?.focus())
  }, [navigate, raiz, seccion])

  const nombreCuenta = cuenta?.nombre ?? 'Cuenta de CuidaRed'
  const titulo = principal ? nombreCuenta
    : subvista ? subvista.titulo
    : suscripcion ? 'Suscripción y pagos'
    : datosCuenta ? 'Datos de la cuenta'
      : actual?.id === 'configuracion' && cuenta?.tipo === 'organizacion' ? 'Configurar organización'
        : actual?.titulo ?? 'Cuenta de CuidaRed'
  const datosCabecera: DatosCabecera = { raiz, enLinea, mostrarAvisos, pendientes, nombreUsuario }
  // En el panel de gestión la suscripción y los datos de la cuenta ya no están en Inicio: se llega por «Más» (móvil) y el menú lateral.
  const conSuscripcion = puedeConsultarSuscripcion(cuenta) && !adicionales.some((modulo) => modulo.id === 'suscripcion')
  const conDatosCuenta = !!cuenta && datosCuentaAparte(cuenta)
  const hayMas = adicionales.length > 0 || seccion === 'mas' || (!!cuenta && tienePanelGestion(cuenta) && (conSuscripcion || conDatosCuenta))
  const barraInferior = cuenta && principal ? <BarraInferior raiz={raiz} pestanas={pestanas} hayMas={hayMas}
    masActivo={adicionales.some((modulo) => modulo.id === seccion)} masAbierto={masAbierto} alAbrirMas={() => setMasLocal(true)} masRef={masRef} /> : null
  const complementos = cuenta && principal && <>
    {barraInferior}
    <AyudaFlotante raiz={raiz} />
    <HojaMas abierta={masAbierto} cerrar={cerrarMas} raiz={raiz} modulos={adicionales.length ? adicionales : visible.filter((modulo) => modulo.id !== 'cuenta')}
      conSuscripcion={conSuscripcion} conDatosCuenta={conDatosCuenta} alElegir={() => setMasLocal(false)}
      rol={cuenta.rol} esOrganizacion={cuenta.tipo === 'organizacion'} alCerrarSesion={() => { void logout({ access_token: token }) }} />
  </>

  if (props && actual?.id === 'miembros') {
    return <>
      <div className={cn(principal && 'pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+88px)] md:pb-0')}>
        <PantallaMiembros token={token} cuenta={props.cuenta} usuarioId={usuarioId} volver={`${raiz}/cuenta`} />
      </div>
      {complementos}
    </>
  }

  return <ContextoPantallaSecundaria value={fijarSubvista}><div className={cn('min-h-dvh bg-bg', cuenta && 'md:grid md:grid-cols-[80px_minmax(0,1fr)] lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]')}>
    <a href="#contenido-operativo" className="sr-only z-50 rounded-md bg-surface p-3 text-navy focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Saltar al contenido</a>
    {cuenta && <MenuLateral raiz={raiz} cuenta={cuenta} modulos={visible} conSuscripcion={puedeConsultarSuscripcion(cuenta)} conDatosCuenta={conDatosCuenta} />}
    <div className={cn('min-w-0', principal ? 'pb-[calc(var(--bottomnav-h)+var(--safe-bottom)+88px)] md:pb-24' : 'pb-[calc(var(--safe-bottom)+12px)] md:pb-0')}>
      {principal ? <BarraSuperior titulo={titulo} {...datosCabecera} /> : <BarraSecundaria titulo={titulo} destino={subvista?.ruta ?? `${raiz}/cuenta`} historial={!!pantalla && !subvista} accion={subvista?.accion} />}
      <CabeceraEscritorio titulo={titulo} {...datosCabecera}
        volver={principal ? undefined : <EnlaceVolver destino={subvista?.ruta ?? `${raiz}/cuenta`} historial={!!pantalla && !subvista} accion={subvista?.accion} />} />
      <main ref={contenido} id="contenido-operativo" tabIndex={-1} className="mx-auto grid w-full max-w-[calc(var(--content-max)+var(--gutter)*2)] gap-5 px-[var(--gutter)] py-5 focus:outline-none sm:py-6">
        {!base ? <p role="alert">No se encontró la cuenta.</p> : <Estado consulta={contexto} />}
        {props && <div key={props.cuenta.cuenta_id} className="grid min-w-0 grid-cols-1 gap-5">
          {!actual && !suscripcion && !datosCuenta && <p role="alert" className="rounded-md border border-line-soft bg-surface p-4">No tienes acceso a este módulo de la cuenta.</p>}
          {vista === 'cuenta' && <Inicio {...props} raiz={raiz} visible={visible} nombreUsuario={nombreUsuario} revision={revision} actualizar={() => setRevision((n) => n + 1)} />}
          {vista === 'configuracion' && <GestionCuenta {...props} vista="configuracion" actualizar={() => setRevision((n) => n + 1)} />}
          {vista === 'envejecientes' && <Envejecientes {...props} cola={cola} />}
          {vista === 'visitas' && <Visitas {...props} cola={cola} />}
          {vista === 'agenda' && <Agenda {...props} />}
          {vista === 'necesidades' && <Necesidades {...props} cola={cola} />}
          {vista === 'alertas' && <Alertas key={navegacion} {...props} alLeerAviso={() => setRevision((n) => n + 1)} />}
          {vista === 'resumen' && <ResumenCasos {...props} />}
          {vista === 'reportes' && <Reportes {...props} />}
          {vista === 'solicitudes-visita' && <SolicitudesVisita {...props} />}
          {vista === 'auditoria' && <AuditoriaCuenta {...props} />}
          {datosCuenta && <GestionCuenta {...props} vista="datos" actualizar={() => setRevision((n) => n + 1)} />}
          {suscripcion && <SuscripcionCuenta {...props} actualizarContexto={actualizarContexto} />}
          {pantalla === 'notificaciones' && <PantallaNotificaciones base={props.base} token={token} raiz={raiz} revision={revision} alCambiar={() => setRevision((n) => n + 1)} />}
          {pantalla === 'conexion' && <PantallaConexion cola={cola} cuentaId={props.cuenta.cuenta_id} enLinea={enLinea} />}
          {pantalla === 'aprende' && <PantallaAprende />}
          {pantalla === 'preguntas' && <PantallaPreguntas />}
          {pantalla === 'idioma' && <PantallaIdioma />}
          {pantalla === 'tema' && <PantallaTema />}
          {pantalla === 'accesibilidad' && <PantallaAccesibilidad />}
          {pantalla === 'soporte' && <PantallaSoporte cuenta={props.cuenta.nombre} volver={() => navigate(`${raiz}/cuenta`)} />}
        </div>}
      </main>
    </div>
    {cuenta && !principal && (pantalla === 'notificaciones' || pantalla === 'conexion') && <AyudaFlotante raiz={raiz} sinBarraInferior />}
    {complementos}
  </div></ContextoPantallaSecundaria>
}
