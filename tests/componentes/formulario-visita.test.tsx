/*
 * formulario-visita.test.tsx — Pruebas de componente del formulario «Registrar visita» del cuidador (CU-05 · RF-02 ·
 * RF-06 · RF-10 · SRS §8.2.2.1.22 «sin perder lo escrito» · CR-188): errores junto al campo y foco al primer campo
 * inválido, conservación de lo escrito tras un error, registro en el store, borrador recuperable, visita programada,
 * alcance por vínculo, trabajo sin conexión y bloqueo por rol (el voluntario no entra al área del cuidador).
 * Módulo: pruebas · visitas (src/features/visitas/pages/RegistrarVisita.tsx).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireRole } from '@/app/guards'
import { ToastProvider } from '@/components/ui'
import { setSimularSinConexion } from '@/domain/conectividad'
import { puede } from '@/domain/permisos'
import { abrirSesion, cerrarSesionLocal } from '@/domain/sesion'
import { getDB, getServidor, resetDemo } from '@/domain/store'
import { visitasRoutes } from '@/features/visitas/routes'

// useShell() entrega por defecto base «/»; en la app real la da AppShell del rol. Se fija la del área del cuidador
// para que los enlaces y navigate() de las pantallas apunten a rutas válidas (el resto de AppShell queda igual).
vi.mock('@/layouts/AppShell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/layouts/AppShell')>()),
  useShell: () => ({ base: '/cuidador', perfilPath: '/cuidador/perfil' }),
}))

const OBSERVACION = 'Se encontró tranquila y comió bien' // sin siglas del catálogo de abreviaturas
const CLAVE_BORRADOR = 'cuidared:borrador:visita:u-cuid:nueva'

type Usuario = ReturnType<typeof userEvent.setup>

/** Monta las rutas reales de visitas dentro del área del cuidador (`RequireRole`), como en src/features/cuidador. */
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

const botonRegistrar = () => screen.getByRole('button', { name: 'Registrar visita' })
const campoAdulto = () => screen.getByLabelText(/^Adulto mayor visitado/)
const campoObservaciones = () => screen.getByLabelText(/^Observaciones/)

async function completar(u: Usuario, opciones: { adulto?: string; estado?: string; observacion?: string } = {}) {
  const { adulto = 'a-elena', estado = 'Estable', observacion = OBSERVACION } = opciones
  if (adulto) await u.selectOptions(campoAdulto(), adulto)
  if (estado) await u.click(screen.getByRole('radio', { name: estado }))
  if (observacion) await u.type(campoObservaciones(), observacion)
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

beforeAll(() => {
  // jsdom no implementa scrollIntoView y el formulario lo usa al enfocar el primer campo inválido.
  Element.prototype.scrollIntoView = () => undefined
})

/**
 * Vuelve a «con conexión». Al recuperar la red, store.ts relee localStorage sin proteger el acceso (releerServidor):
 * con el localStorage roto de Node 25 lanza TypeError, pero el interruptor ya quedó apagado. Ver el bug 1 (it.skip de formulario-perfil.test.tsx).
 */
function volverEnLinea() {
  try {
    setSimularSinConexion(false)
  } catch {
    /* ya está en línea: solo falló la relectura del almacenamiento */
  }
}

beforeEach(() => {
  volverEnLinea()
  cerrarSesionLocal()
  limpiarAlmacenamiento()
  resetDemo()
  abrirSesion('u-cuid', 'm-3') // Carlos Ruiz, cuidador de la Fundación (asignado a Elena, José y Camila)
})

describe('Registrar visita · validación y foco', () => {
  it('al enviar vacío muestra cada error junto a su campo y lleva el foco al primero inválido', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    const antes = getDB().visitas.length
    await u.click(await screen.findByRole('button', { name: 'Registrar visita' }))

    // Cada error está pegado a su campo: aria-invalid + aria-describedby apuntando al mensaje (role="alert").
    expect(campoAdulto()).toHaveAttribute('aria-invalid', 'true')
    expect(campoAdulto()).toHaveAccessibleDescription('Selecciona un perfil de adulto mayor válido.')
    expect(screen.getByRole('radiogroup', { name: /Estado del adulto/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Indica el estado del adulto durante la visita.')).toHaveAttribute('role', 'alert')
    expect(campoObservaciones()).toHaveAttribute('aria-invalid', 'true')
    expect(campoObservaciones()).toHaveAccessibleDescription('Escribe las observaciones.')

    // El primer campo inválido en el orden de la pantalla (el adulto) recibe el foco.
    await waitFor(() => expect(campoAdulto()).toHaveFocus())
    // Nada se registró.
    expect(getDB().visitas).toHaveLength(antes)
  })

  it('el foco va al primer campo que falta, no siempre al de arriba (adulto y estado elegidos, sin observaciones)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    await completar(u, { observacion: '' })
    await u.click(botonRegistrar())

    expect(campoAdulto()).not.toHaveAttribute('aria-invalid')
    expect(campoObservaciones()).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(campoObservaciones()).toHaveFocus())
  })

  it('con el estado del adulto sin elegir, el foco va a su primer tile (un grupo enfoca su primer control)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    await completar(u, { estado: '' })
    await u.click(botonRegistrar())

    expect(screen.getByText('Indica el estado del adulto durante la visita.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Estable' })).toHaveFocus())
  })

  it('el error de un campo desaparece al corregirlo', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    await u.click(await screen.findByRole('button', { name: 'Registrar visita' }))
    expect(screen.getByText('Escribe las observaciones.')).toBeInTheDocument()

    await u.type(campoObservaciones(), OBSERVACION)
    expect(screen.queryByText('Escribe las observaciones.')).not.toBeInTheDocument()
    expect(campoObservaciones()).not.toHaveAttribute('aria-invalid')

    await u.selectOptions(campoAdulto(), 'a-elena')
    expect(screen.queryByText('Selecciona un perfil de adulto mayor válido.')).not.toBeInTheDocument()
  })

  it('una fecha futura se rechaza junto al campo de fecha y recibe el foco antes que los campos de abajo', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva?adulto=a-elena')
    const fecha = await screen.findByLabelText(/^Fecha/)
    fireEvent.change(fecha, { target: { value: '2999-12-31' } })
    await u.click(botonRegistrar())

    expect(fecha).toHaveAttribute('aria-invalid', 'true')
    expect(fecha).toHaveAccessibleDescription('No puede ser una fecha futura.')
    await waitFor(() => expect(fecha).toHaveFocus())
  })

  it('una hora vacía se señala junto a la hora', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva?adulto=a-elena')
    const hora = await screen.findByLabelText(/^Hora/)
    fireEvent.change(hora, { target: { value: '' } })
    await u.click(botonRegistrar())

    expect(hora).toHaveAccessibleDescription('Indica la hora de la visita.')
  })

  it('elegir «Otra…» pide escribir el motivo y el error aparece junto a ese campo', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva?adulto=a-elena')
    expect(screen.queryByLabelText(/^Escribe el motivo/)).not.toBeInTheDocument()
    await u.selectOptions(await screen.findByLabelText(/^Motivo de la visita/), 'otra')
    const motivo = screen.getByLabelText(/^Escribe el motivo/)

    await u.click(botonRegistrar())
    expect(motivo).toHaveAttribute('aria-invalid', 'true')
    expect(motivo).toHaveAccessibleDescription('Escribe el motivo de la visita.')

    await u.type(motivo, 'Acompañamiento a una diligencia')
    expect(motivo).not.toHaveAttribute('aria-invalid')
  })
})

describe('Registrar visita · lo escrito se conserva', () => {
  it('tras un error de validación se conservan el adulto, los aspectos marcados y lo escrito', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    await completar(u, { estado: '' }) // falta el estado del adulto
    await u.click(screen.getByRole('checkbox', { name: 'Toma de medicamentos' }))
    await u.click(botonRegistrar())

    // El error se ve y NADA de lo escrito se perdió.
    expect(screen.getByText('Indica el estado del adulto durante la visita.')).toBeInTheDocument()
    expect(campoAdulto()).toHaveValue('a-elena')
    expect(campoObservaciones()).toHaveValue(OBSERVACION)
    expect(screen.getByRole('checkbox', { name: 'Toma de medicamentos' })).toBeChecked()

    // Se corrige solo lo que faltaba y el mismo formulario se envía bien.
    await u.click(screen.getByRole('radio', { name: 'Estable' }))
    await u.click(botonRegistrar())
    expect(await screen.findByRole('heading', { name: 'Visita registrada correctamente' })).toBeInTheDocument()
  })

  it('el borrador se recupera al volver a abrir el formulario y se puede descartar', async () => {
    const u = userEvent.setup()
    const primera = abrir('/cuidador/visitas/nueva')
    await u.type(await screen.findByLabelText(/^Observaciones/), OBSERVACION)
    primera.unmount()
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toContain(OBSERVACION)

    abrir('/cuidador/visitas/nueva')
    expect(await screen.findByText('Recuperamos lo que estabas escribiendo.')).toBeInTheDocument()
    expect(campoObservaciones()).toHaveValue(OBSERVACION)

    await u.click(screen.getByRole('button', { name: 'Descartar el borrador y empezar de nuevo' }))
    expect(screen.queryByText('Recuperamos lo que estabas escribiendo.')).not.toBeInTheDocument()
    expect(campoObservaciones()).toHaveValue('')
  })
})

describe('Registrar visita · registro en el store', () => {
  it('un envío válido registra la visita (completada, con sus datos y su auditoría) y muestra la confirmación', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    const antes = getDB().visitas.length
    await completar(u, { adulto: 'a-jose' })
    await u.click(screen.getByRole('checkbox', { name: 'Toma de medicamentos' }))
    await u.click(botonRegistrar())

    expect(await screen.findByRole('heading', { name: 'Visita registrada correctamente' })).toBeInTheDocument()
    const db = getDB()
    expect(db.visitas).toHaveLength(antes + 1)
    const nueva = db.visitas.find((v) => v.observaciones === OBSERVACION)
    expect(nueva).toMatchObject({
      adultoId: 'a-jose',
      cuidadorId: 'u-cuid',
      estado: 'completada',
      estadoAdulto: 'estable',
      razon: 'Seguimiento periódico',
      checklist: ['medicamentos'],
      actualizadoPor: 'u-cuid',
    })
    expect(nueva?.pendienteSync).toBeUndefined() // con conexión se guarda directo en el servidor
    expect(db.auditoria.some((a) => a.accion === 'visita.registrar' && a.registroId === nueva?.id && a.usuarioId === 'u-cuid')).toBe(true)
    // Registrada con éxito: el borrador ya no existe y se propone registrar una necesidad detectada en la visita.
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull()
    expect(screen.getByRole('link', { name: 'Registrar necesidad' })).toHaveAttribute('href', `/cuidador/necesidades/nueva?adulto=a-jose&visita=${nueva?.id}`)
  })

  it('«Situación crítica» registra la visita y genera una alerta de emergencia para el adulto (RF-04)', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva')
    await completar(u, { adulto: 'a-camila', estado: 'Situación crítica', observacion: 'No responde cuando se le habla' })
    await u.click(botonRegistrar())

    expect(await screen.findByRole('heading', { name: 'Visita registrada correctamente' })).toBeInTheDocument()
    const alerta = getDB().alertas.find((a) => a.titulo === 'Situación crítica reportada en visita' && a.adultoId === 'a-camila')
    expect(alerta).toMatchObject({ tipo: 'emergencia', severidad: 'alta', estado: 'pendiente', generadaPor: 'u-cuid' })
  })

  it('completa una visita programada (?visita=) sin crear una nueva y precarga su adulto', async () => {
    const u = userEvent.setup()
    abrir('/cuidador/visitas/nueva?visita=v-3') // Elena · hoy 15:00 · programada para u-cuid
    const total = getDB().visitas.length
    expect(await screen.findByText(/Visita programada/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Adulto mayor visitado/)).not.toBeInTheDocument() // el adulto viene fijo

    await u.click(screen.getByRole('radio', { name: 'Requiere atención' }))
    await u.type(campoObservaciones(), OBSERVACION)
    await u.click(botonRegistrar())

    expect(await screen.findByRole('heading', { name: 'Visita registrada correctamente' })).toBeInTheDocument()
    expect(getDB().visitas).toHaveLength(total)
    expect(getDB().visitas.find((v) => v.id === 'v-3')).toMatchObject({ estado: 'completada', estadoAdulto: 'requiere_atencion', observaciones: OBSERVACION })
  })

  it('una visita ya cerrada no se puede volver a registrar', async () => {
    abrir('/cuidador/visitas/nueva?visita=v-1') // completada en la semilla
    expect(await screen.findByText('Esta visita ya fue cerrada')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de visita' })).not.toBeInTheDocument()
  })
})

describe('Registrar visita · alcance por vínculo', () => {
  it('un adulto fuera de los asignados al cuidador (de un voluntario) no abre el formulario', async () => {
    abrir('/cuidador/visitas/nueva?adulto=a-alicia')
    expect(await screen.findByText('No encontrado o sin permiso')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de visita' })).not.toBeInTheDocument()
  })

  it('una visita inexistente muestra lo mismo (no revela si existe)', async () => {
    abrir('/cuidador/visitas/nueva?visita=v-no-existe')
    expect(await screen.findByText('No encontrado o sin permiso')).toBeInTheDocument()
  })

  it('la lista de adultos del cuidador solo trae sus asignados', async () => {
    abrir('/cuidador/visitas/nueva')
    await screen.findByLabelText(/^Adulto mayor visitado/)
    const valores = Array.from((campoAdulto() as HTMLSelectElement).options)
      .map((o) => o.value)
      .filter(Boolean)
      .sort()
    expect(valores).toEqual(['a-camila', 'a-elena', 'a-jose'])
  })
})

describe('Registrar visita · sin conexión (RF-10)', () => {
  it('avisa que se guardará en el dispositivo y deja la visita pendiente de sincronización', async () => {
    const u = userEvent.setup()
    setSimularSinConexion(true)
    abrir('/cuidador/visitas/nueva?adulto=a-elena')
    expect(await screen.findByText(/Sin conexión: la visita se guardará en el dispositivo/)).toHaveAttribute('role', 'status')

    await u.click(screen.getByRole('radio', { name: 'Estable' }))
    await u.type(campoObservaciones(), OBSERVACION)
    await u.click(botonRegistrar())

    expect(await screen.findByText('Guardada en el dispositivo · Pendiente de sincronización')).toBeInTheDocument()
    // En la vista del usuario aparece marcada como pendiente; el servidor todavía no la tiene.
    expect(getDB().visitas.find((v) => v.observaciones === OBSERVACION)?.pendienteSync).toBe(true)
    expect(getServidor().visitas.some((v) => v.observaciones === OBSERVACION)).toBe(false)
  })
})

describe('Registrar visita · acceso según el rol', () => {
  it('el voluntario no puede abrir este formulario en el área del cuidador (guard de rol)', async () => {
    abrirSesion('u-vol', 'm-9') // Miguel Acosta, voluntario
    abrir('/cuidador/visitas/nueva?adulto=a-alicia') // aunque Alicia sea su adulto asignado
    expect(await screen.findByTestId('acceso-denegado')).toBeInTheDocument()
    expect(screen.getByText('Acceso no autorizado')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de visita' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar visita' })).not.toBeInTheDocument()
  })

  it('el familiar tampoco: no tiene permiso de registrar visitas', async () => {
    abrirSesion('u-fam', 'm-4')
    expect(puede(getDB().usuarios.find((x) => x.id === 'u-fam'), 'visitas:registrar')).toBe(false)
    abrir('/cuidador/visitas/nueva?adulto=a-elena')
    expect(await screen.findByTestId('acceso-denegado')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Registro de visita' })).not.toBeInTheDocument()
  })

  it('sin sesión se redirige al inicio de sesión', async () => {
    cerrarSesionLocal()
    abrir('/cuidador/visitas/nueva')
    expect(await screen.findByText('Pantalla de inicio de sesión')).toBeInTheDocument()
  })
})
