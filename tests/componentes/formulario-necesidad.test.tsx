/*
 * formulario-necesidad.test.tsx — Pruebas de componente del formulario «Registrar necesidad» (CU-07 · RF-03 · RF-04 ·
 * RF-06 · RF-10 · CR-188): validación por campo (al salir de él y al enviar), foco al primer campo inválido, lo escrito
 * se conserva, registro exitoso en el store (estado «Pendiente», prioridad por categoría, alerta de medicamentos) y
 * permisos por rol (el voluntario y el familiar no pueden registrar necesidades).
 * Módulo: pruebas · visitas (src/features/visitas/pages/RegistrarNecesidad.tsx).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireRole } from '@/app/guards'
import { ToastProvider } from '@/components/ui'
import { setSimularSinConexion } from '@/domain/conectividad'
import { puede } from '@/domain/permisos'
import { abrirSesion, cerrarSesionLocal } from '@/domain/sesion'
import { getDB, getServidor, resetDemo } from '@/domain/store'
import type { Usuario } from '@/domain/types'
import { visitasRoutes } from '@/features/visitas/routes'
import { voluntarioRoutes } from '@/features/voluntario/routes'

// useShell() entrega por defecto base «/»; en la app real la da AppShell del rol. Se fija la del área del cuidador
// para que los enlaces y navigate() de las pantallas apunten a rutas válidas (el resto de AppShell queda igual).
vi.mock('@/layouts/AppShell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/layouts/AppShell')>()),
  useShell: () => ({ base: '/cuidador', perfilPath: '/cuidador/perfil' }),
}))

const DESCRIPCION = 'Necesita reposición de losartán'
const CLAVE_BORRADOR = 'cuidared:borrador:necesidad:u-cuid:nueva'

type Ev = ReturnType<typeof userEvent.setup>

/** Rutas reales de visitas/necesidades en el área del cuidador (`RequireRole`). */
function abrir(ruta: string) {
  const router = createMemoryRouter(
    [
      { path: '/inicio', element: <p>Pantalla de inicio de sesión</p> },
      {
        path: '/cuidador',
        element: (
          <RequireRole rol="cuidador">
            <Outlet />
          </RequireRole>
        ),
        children: visitasRoutes(),
      },
    ],
    { initialEntries: [ruta] },
  )
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
}

/** Las mismas rutas SIN el guard de rol: solo las protege el permiso de cada pantalla (RequirePermiso). */
function abrirSoloConPermiso(ruta: string) {
  const router = createMemoryRouter([{ path: '/area', element: <Outlet />, children: visitasRoutes() }], { initialEntries: [ruta] })
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
}

const botonRegistrar = () => screen.getByRole('button', { name: 'Registrar necesidad' })
const campoAdulto = () => screen.getByLabelText(/^Adulto mayor/)
const campoCategoria = () => screen.getByLabelText(/^Categoría/)
const campoDescripcion = () => screen.getByLabelText(/^Descripción/)
const campoCantidad = () => screen.getByLabelText(/^Cantidad/)
const campoUnidad = () => screen.getByLabelText(/^Unidad/)
const prioridad = (nombre: string) => screen.getByRole('radio', { name: nombre })

async function completar(u: Ev, opciones: { adulto?: string; tipo?: string; descripcion?: string } = {}) {
  const { adulto = 'a-elena', tipo = 'medicamentos', descripcion = DESCRIPCION } = opciones
  if (adulto) await u.selectOptions(campoAdulto(), adulto)
  if (tipo) await u.selectOptions(campoCategoria(), tipo)
  if (descripcion) await u.type(campoDescripcion(), descripcion)
}

/** El store guarda su estado en memoria; esto evita que un borrador de otra prueba se «recupere» en esta. */
function limpiarAlmacenamiento() {
  for (const almacen of [() => localStorage, () => sessionStorage]) {
    try {
      almacen().clear()
    } catch {
      /* Node 25 expone un localStorage global sin métodos (webstorage sin archivo): el dominio ya lo tolera */
    }
  }
}

/** Ver formulario-visita.test.tsx: al volver la red, store.ts relee localStorage sin protegerlo (bug 1 del reporte). */
function volverEnLinea() {
  try {
    setSimularSinConexion(false)
  } catch {
    /* ya está en línea: solo falló la relectura del almacenamiento */
  }
}

beforeAll(() => {
  // jsdom no implementa scrollIntoView y los formularios lo usan al enfocar el primer campo inválido.
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  volverEnLinea()
  cerrarSesionLocal()
  limpiarAlmacenamiento()
  resetDemo()
  abrirSesion('u-cuid', 'm-3') // Carlos Ruiz, cuidador de la Fundación (asignado a Elena, José y Camila)
})

describe('Registrar necesidad · validación por campo', () => {
  it('al enviar vacío muestra cada error junto a su campo y enfoca el primero inválido (el adulto)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva')
    const antes = getDB().necesidades.length
    await u.click(await screen.findByRole('button', { name: 'Registrar necesidad' }))

    expect(campoAdulto()).toHaveAttribute('aria-invalid', 'true')
    expect(campoAdulto()).toHaveAccessibleDescription('Selecciona el adulto mayor.')
    expect(campoCategoria()).toHaveAttribute('aria-invalid', 'true')
    expect(campoCategoria()).toHaveAccessibleDescription('Selecciona la categoría de la necesidad.')
    expect(campoDescripcion()).toHaveAttribute('aria-invalid', 'true')
    expect(campoDescripcion()).toHaveAccessibleDescription('Escribe la descripción.')
    // Los campos opcionales no se marcan.
    expect(campoCantidad()).not.toHaveAttribute('aria-invalid')
    expect(campoUnidad()).not.toHaveAttribute('aria-invalid')

    await waitFor(() => expect(campoAdulto()).toHaveFocus())
    expect(getDB().necesidades).toHaveLength(antes)
  })

  it('el foco va al primer campo que falta (adulto y categoría elegidos, falta la descripción)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva')
    await completar(u, { descripcion: '' })
    await u.click(botonRegistrar())

    expect(campoAdulto()).not.toHaveAttribute('aria-invalid')
    expect(campoCategoria()).not.toHaveAttribute('aria-invalid')
    expect(campoDescripcion()).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(campoDescripcion()).toHaveFocus())
  })

  it('la descripción se valida al salir del campo, no mientras se escribe', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    const descripcion = await screen.findByLabelText(/^Descripción/)

    await u.type(descripcion, 'abc')
    expect(descripcion).not.toHaveAttribute('aria-invalid') // todavía escribiendo
    await u.tab() // sale del campo
    expect(descripcion).toHaveAttribute('aria-invalid', 'true')
    expect(descripcion).toHaveAccessibleDescription('Escribe al menos 5 caracteres en la descripción.')

    await u.type(descripcion, 'de')
    expect(descripcion).not.toHaveAttribute('aria-invalid') // al corregir, el error se va
  })

  it('una cantidad no válida se señala junto a la cantidad al salir de ella', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    const cantidad = await screen.findByLabelText(/^Cantidad/)

    await u.type(cantidad, '0')
    await u.tab()
    expect(cantidad).toHaveAccessibleDescription('Indica una cantidad válida.')

    await u.clear(cantidad)
    await u.type(cantidad, '20000')
    expect(cantidad).toHaveAccessibleDescription('Indica una cantidad válida.')
  })

  it('con cantidad pero sin unidad, el error aparece en la unidad y recibe el foco', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'alimentacion')
    await u.type(campoDescripcion(), 'Canasta de alimentos del mes')
    await u.type(campoCantidad(), '2')
    await u.click(botonRegistrar())

    expect(campoUnidad()).toHaveAttribute('aria-invalid', 'true')
    expect(campoUnidad()).toHaveAccessibleDescription('Selecciona la unidad.')
    await waitFor(() => expect(campoUnidad()).toHaveFocus())

    await u.selectOptions(campoUnidad(), 'cajas')
    expect(campoUnidad()).not.toHaveAttribute('aria-invalid')
  })

  it('las abreviaturas de la descripción se expanden al escribir (RF-06)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    await u.type(await screen.findByLabelText(/^Descripción/), 'Necesita meds para la hta ')
    expect(campoDescripcion()).toHaveValue('Necesita medicamentos para la hipertensión ')
  })
})

describe('Registrar necesidad · categoría y prioridad', () => {
  it('«Medicamentos» avisa que genera una alerta y la prioridad por defecto es Alta; otras categorías, Media', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'medicamentos')
    expect(screen.getByRole('note')).toHaveTextContent('Generará una alerta de caso prioritario.')
    expect(prioridad('Alta')).toHaveAttribute('aria-checked', 'true')

    await u.selectOptions(campoCategoria(), 'transporte')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(prioridad('Media')).toHaveAttribute('aria-checked', 'true')
    expect(prioridad('Alta')).toHaveAttribute('aria-checked', 'false')
  })

  it('al elegir categoría se ofrecen solo las necesidades del catálogo de esa categoría', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'transporte')
    const catalogo = await screen.findByLabelText(/^Necesidad$/)
    const opciones = Array.from((catalogo as HTMLSelectElement).options).map((o) => o.textContent)
    expect(opciones).toEqual(['Sin especificar', 'Traslado a cita médica', 'Traslado para diligencias'])
  })
})

describe('Registrar necesidad · lo escrito se conserva', () => {
  it('tras un error de validación se conservan el adulto, la descripción y la cantidad', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva')
    await completar(u, { tipo: '' }) // falta la categoría
    await u.type(campoCantidad(), '30')
    await u.click(botonRegistrar())

    expect(campoCategoria()).toHaveAccessibleDescription('Selecciona la categoría de la necesidad.')
    expect(campoAdulto()).toHaveValue('a-elena')
    expect(campoDescripcion()).toHaveValue(DESCRIPCION)
    expect(campoCantidad()).toHaveValue(30)
    await waitFor(() => expect(campoCategoria()).toHaveFocus())

    // Corrige solo la categoría (y la unidad que ahora exige la cantidad) y se registra.
    await u.selectOptions(campoCategoria(), 'medicamentos')
    await u.selectOptions(campoUnidad(), 'tabletas')
    await u.click(botonRegistrar())
    expect(await screen.findByText('Necesidad registrada correctamente')).toBeInTheDocument()
  })

  it('el borrador se recupera al volver a abrir el formulario', async () => {
    const u = userEvent.setup()
    const primera = abrir('/cuidador/necesidades/nueva')
    await u.type(await screen.findByLabelText(/^Descripción/), DESCRIPCION)
    primera.unmount()
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toContain(DESCRIPCION)

    abrir('/cuidador/necesidades/nueva')
    expect(await screen.findByText('Recuperamos lo que estabas escribiendo.')).toBeInTheDocument()
    expect(campoDescripcion()).toHaveValue(DESCRIPCION)
  })
})

describe('Registrar necesidad · registro en el store', () => {
  it('un envío válido registra la necesidad como «Pendiente» y genera la alerta de medicamentos', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva')
    const antes = getDB().necesidades.length
    await completar(u, { adulto: 'a-elena', tipo: 'medicamentos' })
    await u.type(campoCantidad(), '30')
    await u.selectOptions(campoUnidad(), 'tabletas')
    await u.click(screen.getByRole('switch', { name: /Necesidad recurrente/ }))
    await u.click(botonRegistrar())

    expect(await screen.findByText('Necesidad registrada correctamente')).toBeInTheDocument()
    expect(screen.getByText('Estado: Pendiente')).toBeInTheDocument()
    const db = getDB()
    expect(db.necesidades).toHaveLength(antes + 1)
    const nueva = db.necesidades.find((n) => n.descripcion === DESCRIPCION)
    expect(nueva).toMatchObject({
      adultoId: 'a-elena',
      tipo: 'medicamentos',
      prioridad: 'alta',
      estado: 'pendiente',
      cantidad: 30,
      unidad: 'tabletas',
      recurrente: true,
      registradaPor: 'u-cuid',
    })
    expect(nueva?.historial).toEqual([expect.objectContaining({ estado: 'pendiente', usuarioId: 'u-cuid' })])
    expect(db.auditoria.some((a) => a.accion === 'necesidad.crear' && a.registroId === nueva?.id && a.usuarioId === 'u-cuid')).toBe(true)
    // RF-04: una necesidad de medicamentos pendiente genera un caso prioritario.
    expect(db.alertas.some((a) => a.adultoId === 'a-elena' && a.estado !== 'atendida' && a.condiciones?.includes('Necesidad de medicamentos pendiente'))).toBe(true)
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull()
  })

  it('una categoría que no es de medicamentos queda con prioridad Media y no genera caso prioritario', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva')
    await completar(u, { adulto: 'a-camila', tipo: 'compania', descripcion: 'Quiere recibir visitas por las tardes' })
    await u.click(botonRegistrar())

    expect(await screen.findByText('Necesidad registrada correctamente')).toBeInTheDocument()
    const nueva = getDB().necesidades.find((n) => n.descripcion === 'Quiere recibir visitas por las tardes')
    expect(nueva).toMatchObject({ adultoId: 'a-camila', tipo: 'compania', prioridad: 'media', estado: 'pendiente', recurrente: false })
    expect(getDB().alertas.some((a) => a.adultoId === 'a-camila' && a.estado !== 'atendida' && a.condiciones?.includes('Necesidad de medicamentos pendiente'))).toBe(false)
  })

  it('con ?adulto= y ?visita= el adulto va fijo y la necesidad queda asociada a esa visita', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena&visita=v-1')
    expect(await screen.findByText('Se asociará a la visita que acabas de registrar.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Adulto mayor/)).not.toBeInTheDocument() // viene del perfil, no se elige

    await u.selectOptions(campoCategoria(), 'compania')
    await u.type(campoDescripcion(), 'Le gustaría más compañía')
    await u.click(botonRegistrar())

    expect(await screen.findByText('Necesidad registrada correctamente')).toBeInTheDocument()
    expect(getDB().necesidades.find((n) => n.descripcion === 'Le gustaría más compañía')).toMatchObject({ adultoId: 'a-elena', visitaId: 'v-1' })
  })

  it('una visita de otro adulto no se asocia', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-elena&visita=v-2') // v-2 es de José
    await screen.findByLabelText(/^Categoría/)
    expect(screen.queryByText('Se asociará a la visita que acabas de registrar.')).not.toBeInTheDocument()

    await u.selectOptions(campoCategoria(), 'otros')
    await u.type(campoDescripcion(), 'Cambiar la bombilla del pasillo')
    await u.click(botonRegistrar())
    expect(await screen.findByText('Necesidad registrada correctamente')).toBeInTheDocument()
    expect(getDB().necesidades.find((n) => n.descripcion === 'Cambiar la bombilla del pasillo')?.visitaId).toBeUndefined()
  })

  it('relaciona la necesidad con una indicación médica vigente del adulto (solo quien puede verlas)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/necesidades/nueva?adulto=a-jose')
    await u.selectOptions(await screen.findByLabelText(/^Categoría/), 'medicamentos')
    await u.type(campoDescripcion(), 'Reposición de losartán, quedan tres días')
    await u.selectOptions(screen.getByLabelText(/^Indicación médica relacionada/), 'im-1')
    await u.click(botonRegistrar())

    expect(await screen.findByText('Necesidad registrada correctamente')).toBeInTheDocument()
    expect(getDB().necesidades.find((n) => n.descripcion === 'Reposición de losartán, quedan tres días')).toMatchObject({ adultoId: 'a-jose', indicacionId: 'im-1' })
  })
})

describe('Registrar necesidad · alcance y conexión', () => {
  it('un adulto fuera de los asignados al cuidador no abre el formulario', async () => {
    abrir('/cuidador/necesidades/nueva?adulto=a-alicia')
    expect(await screen.findByText('No encontrado o sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de necesidad' })).not.toBeInTheDocument()
  })

  it('sin conexión avisa que se guardará en el dispositivo y queda pendiente de sincronización (RF-10)', async () => {
    const u = userEvent.setup()
    setSimularSinConexion(true)
    abrir('/cuidador/necesidades/nueva?adulto=a-elena')
    expect(await screen.findByText(/Sin conexión: la necesidad se guardará en el dispositivo/)).toHaveAttribute('role', 'status')

    await u.selectOptions(campoCategoria(), 'alimentacion')
    await u.type(campoDescripcion(), 'Canasta de alimentos del mes')
    await u.click(botonRegistrar())

    expect(await screen.findByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeInTheDocument()
    expect(getDB().necesidades.find((n) => n.descripcion === 'Canasta de alimentos del mes')?.pendienteSync).toBe(true)
    expect(getServidor().necesidades.some((n) => n.descripcion === 'Canasta de alimentos del mes')).toBe(false)
  })
})

describe('Registrar necesidad · permisos por rol', () => {
  const usuario = (id: string) => getDB().usuarios.find((x) => x.id === id) as Usuario

  it('el voluntario no tiene el permiso de registrar necesidades; cuidador y coordinador sí', () => {
    expect(puede(usuario('u-vol'), 'necesidades:registrar')).toBe(false)
    expect(puede(usuario('u-vol'), 'necesidades:ver')).toBe(false)
    expect(puede(usuario('u-fam'), 'necesidades:registrar')).toBe(false)
    expect(puede(usuario('u-cuid'), 'necesidades:registrar')).toBe(true)
    expect(puede(usuario('u-coord'), 'necesidades:registrar')).toBe(true)
  })

  it('el voluntario no puede abrir el formulario en el área del cuidador (guard de rol)', async () => {
    abrirSesion('u-vol', 'm-9')
    abrir('/cuidador/necesidades/nueva?adulto=a-alicia')
    expect(await screen.findByTestId('acceso-denegado')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de necesidad' })).not.toBeInTheDocument()
  })

  it.each([
    ['voluntario', 'u-vol', 'm-9'],
    ['familiar', 'u-fam', 'm-4'],
  ])('aunque la ruta se monte sin guard de rol, el permiso necesidades:registrar bloquea al %s por URL directa', async (_rol, usuarioId, membresiaId) => {
    abrirSesion(usuarioId, membresiaId)
    abrirSoloConPermiso('/area/necesidades/nueva')
    expect(await screen.findByTestId('acceso-denegado')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de necesidad' })).not.toBeInTheDocument()
  })

  it('la misma ruta, con permiso, sí muestra el formulario (el guard no bloquea de más)', async () => {
    abrirSoloConPermiso('/area/necesidades/nueva')
    expect(await screen.findByRole('form', { name: 'Registro de necesidad' })).toBeInTheDocument()
    expect(screen.queryByTestId('acceso-denegado')).not.toBeInTheDocument()
  })

  it('el área del voluntario no monta las rutas de necesidades ni usa RequirePermiso para ellas', () => {
    const rutas = (voluntarioRoutes.children ?? []).map((r) => r.path ?? '(índice)')
    expect(rutas).toContain('visitas/nueva') // su registro mínimo de visita
    expect(rutas.some((p) => p.startsWith('necesidades'))).toBe(false)
  })
})
