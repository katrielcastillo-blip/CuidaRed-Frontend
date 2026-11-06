/*
 * kit-formularios.test.tsx — Pruebas del kit de formularios con un formulario mínimo de prueba (CR-178 · RF-06 ·
 * SRS §8.2.2.1.22 · CR-188): `useFormulario` (validación por campo, foco al primer inválido, errores del servicio,
 * borrador), `FormPasos` (validación por paso, Anterior/Siguiente, vuelta al paso con error, aviso «Recuperamos lo
 * que estabas escribiendo» tras desmontar y montar) y `TextareaAbreviado` (expansión al escribir, sugerencias y
 * «Procesar abreviaturas»).
 * Módulo: pruebas · kit de componentes UI (src/components/ui).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Checkbox, ChoicePills, FormPasos, TextareaAbreviado, TextField, ToastProvider, requerido, useFormulario } from '@/components/ui'

type Prioridad = 'alta' | 'media' | 'baja'

interface Valores {
  nombre: string
  correo: string
  notas: string
  acepta: boolean
  prioridad: Prioridad | ''
}

const INICIAL: Valores = { nombre: '', correo: '', notas: '', acepta: false, prioridad: '' }
const CLAVE = 'prueba:kit'
const CLAVE_BORRADOR = `cuidared:borrador:${CLAVE}`

interface PropsPrueba {
  alGuardar?: (v: Valores) => unknown
  pasoInicial?: number
  excluirDeBorrador?: Array<keyof Valores>
  guardarDeshabilitado?: boolean
  onCancelar?: () => void
}

/** Formulario mínimo de dos pasos: «Datos» (nombre, correo) y «Detalle» (notas con abreviaturas, casilla y prioridad). */
function FormularioPrueba({ alGuardar = () => ({ ok: true }), pasoInicial, excluirDeBorrador, guardarDeshabilitado, onCancelar }: PropsPrueba) {
  const f = useFormulario<Valores>({
    clave: CLAVE,
    inicial: INICIAL,
    campos: ['nombre', 'correo', 'notas', 'acepta', 'prioridad'],
    excluirDeBorrador,
    reglas: {
      nombre: requerido('Escribe el nombre.'),
      correo: (v) => (!v.trim() ? 'Escribe el correo.' : !v.includes('@') ? 'El correo no es válido.' : undefined),
      notas: (v) => (v.trim().length < 3 ? 'Escribe las notas (mínimo 3 caracteres).' : undefined),
      acepta: requerido('Debes aceptar las condiciones.'),
      prioridad: requerido('Elige la prioridad.'),
    },
  })
  return (
    <FormPasos
      titulo="Formulario de prueba"
      formulario={f}
      alGuardar={alGuardar}
      textoGuardar="Guardar prueba"
      onCancelar={onCancelar}
      pasoInicial={pasoInicial}
      guardarDeshabilitado={guardarDeshabilitado}
      motivoDeshabilitado="Sin conexión: no se puede guardar."
      pasos={[
        {
          id: 'datos',
          titulo: 'Datos',
          campos: ['nombre', 'correo'],
          contenido: (
            <>
              <TextField label="Nombre" required {...f.campo('nombre')} />
              <TextField label="Correo" type="email" required {...f.campo('correo')} />
            </>
          ),
        },
        {
          id: 'detalle',
          titulo: 'Detalle',
          campos: ['notas', 'acepta', 'prioridad'],
          contenido: (
            <>
              <TextareaAbreviado label="Notas" required {...f.abreviado('notas')} />
              <Checkbox label="Acepto las condiciones" {...f.casilla('acepta')} />
              <ChoicePills<Prioridad>
                label="Prioridad"
                required
                options={[
                  { value: 'alta', label: 'Alta' },
                  { value: 'media', label: 'Media' },
                  { value: 'baja', label: 'Baja' },
                ]}
                {...f.valor('prioridad')}
              />
            </>
          ),
        },
      ]}
    />
  )
}

const montar = (props: PropsPrueba = {}) =>
  render(
    <ToastProvider>
      <FormularioPrueba {...props} />
    </ToastProvider>,
  )

const nombre = () => screen.getByLabelText(/^Nombre/)
const correo = () => screen.getByLabelText(/^Correo/)
const notas = () => screen.getByLabelText(/^Notas/)
const acepta = () => screen.getByRole('checkbox', { name: 'Acepto las condiciones' })
const siguiente = () => screen.getByRole('button', { name: 'Siguiente' })
const anterior = () => screen.getByRole('button', { name: 'Anterior' })
const guardar = () => screen.getByRole('button', { name: 'Guardar prueba' })
const encabezadoPaso = (texto: string) => screen.getByText(texto).closest('p') as HTMLElement

type Ev = ReturnType<typeof userEvent.setup>

/**
 * Fotogramas controlados: requestAnimationFrame no avanza solo, la prueba decide cuándo «pasa un fotograma».
 * Hace determinista el foco al cambiar de paso (si no, depende de cuánto tarde en pintarse el paso, ver el bug 2).
 * El `restoreMocks` de vitest.config.ts devuelve el original antes de la prueba siguiente.
 */
function controlarFotogramas() {
  const cola: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => cola.push(cb))
  return {
    /** Ejecuta los fotogramas pendientes y los que estos vuelvan a pedir (hasta `max` fotogramas seguidos). */
    pasar(max = 10) {
      for (let i = 0; i < max && cola.length; i++) cola.splice(0).forEach((cb) => cb(performance.now()))
    },
  }
}
async function pasarPaso1(u: Ev) {
  await u.type(nombre(), 'Ana María')
  await u.type(correo(), 'ana@correo.do')
  await u.click(siguiente())
}

beforeAll(() => {
  // jsdom no implementa scrollIntoView y FormPasos llama a window.scrollTo al cambiar de paso (solo registra «not implemented»).
  Element.prototype.scrollIntoView = () => undefined
  window.scrollTo = () => undefined
})

beforeEach(() => {
  try {
    sessionStorage.clear() // los borradores viven en sessionStorage
  } catch {
    /* sin almacenamiento: los borradores no se conservarán */
  }
})

describe('requerido()', () => {
  it('rechaza vacíos (también solo espacios, listas vacías, casillas sin marcar, null) y acepta lo demás', () => {
    const regla = requerido('Obligatorio')
    for (const vacio of ['', '   ', [], false, null, undefined]) expect(regla(vacio)).toBe('Obligatorio')
    for (const lleno of ['a', ' a ', ['x'], true, 0]) expect(regla(lleno)).toBeUndefined()
  })
})

describe('FormPasos · validación por paso', () => {
  it('abre en el primer paso y «Siguiente» sin completar muestra los errores del paso y enfoca el primero', async () => {
    const u = userEvent.setup()
    montar()
    expect(screen.getByText('Paso 1 de 2 · Datos')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // nada de errores antes de intentar

    await u.click(siguiente())

    expect(screen.getByText('Paso 1 de 2 · Datos')).toBeInTheDocument() // no avanza
    expect(nombre()).toHaveAccessibleDescription('Escribe el nombre.')
    expect(correo()).toHaveAccessibleDescription('Escribe el correo.')
    expect(nombre()).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(nombre()).toHaveFocus())
  })

  it('el foco va al primer campo inválido del paso, no siempre al primero (solo falla el correo)', async () => {
    const u = userEvent.setup()
    montar()
    await u.type(nombre(), 'Ana')
    await u.type(correo(), 'sin-arroba')
    await u.click(siguiente())

    expect(nombre()).not.toHaveAttribute('aria-invalid')
    expect(correo()).toHaveAccessibleDescription('El correo no es válido.')
    await waitFor(() => expect(correo()).toHaveFocus())
  })

  it('cada paso valida solo sus campos: al avanzar no aparecen errores de los pasos siguientes', async () => {
    const u = userEvent.setup()
    montar()
    await pasarPaso1(u)

    expect(screen.getByText('Paso 2 de 2 · Detalle')).toBeInTheDocument()
    expect(encabezadoPaso('Paso 2 de 2 · Detalle')).toHaveFocus() // se anuncia el paso nuevo
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(notas()).not.toHaveAttribute('aria-invalid')
  })

  it('Intro en el último campo de un paso equivale a «Siguiente»: valida y avanza sin guardar', async () => {
    const u = userEvent.setup()
    const alGuardar = vi.fn()
    montar({ alGuardar })
    await u.type(nombre(), 'Ana')
    await u.type(correo(), 'ana@correo.do{Enter}')

    expect(await screen.findByText('Paso 2 de 2 · Detalle')).toBeInTheDocument()
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('«Anterior» vuelve al paso previo conservando lo escrito', async () => {
    const u = userEvent.setup()
    montar()
    await pasarPaso1(u)
    await u.type(notas(), 'Algo de contexto')
    await u.click(anterior())

    expect(screen.getByText('Paso 1 de 2 · Datos')).toBeInTheDocument()
    expect(nombre()).toHaveValue('Ana María')
    expect(correo()).toHaveValue('ana@correo.do')
    await u.click(siguiente())
    expect(notas()).toHaveValue('Algo de contexto')
  })

  it('«Cancelar» aparece en el primer paso cuando se pasa onCancelar', async () => {
    const u = userEvent.setup()
    const onCancelar = vi.fn()
    montar({ onCancelar })
    await u.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalledOnce()
  })

  it('en el último paso «Guardar» muestra los errores de ese paso y enfoca el primero; un grupo enfoca su primer control', async () => {
    const u = userEvent.setup()
    const alGuardar = vi.fn()
    montar({ alGuardar })
    await pasarPaso1(u)
    await u.click(guardar())

    expect(notas()).toHaveAccessibleDescription('Escribe las notas (mínimo 3 caracteres).')
    expect(acepta()).toHaveAccessibleDescription('Debes aceptar las condiciones.')
    expect(screen.getByRole('radiogroup', { name: /Prioridad/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Elige la prioridad.')).toBeInTheDocument()
    await waitFor(() => expect(notas()).toHaveFocus())
    expect(alGuardar).not.toHaveBeenCalled()

    // Con notas y casilla correctas, el foco va al primer control del grupo de prioridad.
    await u.type(notas(), 'Contexto suficiente')
    await u.click(acepta())
    await u.click(guardar())
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Alta' })).toHaveFocus())
    expect(alGuardar).not.toHaveBeenCalled()
  })

  it('si el primer error está en otro paso, «Guardar» vuelve a ese paso y enfoca el campo', async () => {
    const u = userEvent.setup()
    const alGuardar = vi.fn()
    const fotogramas = controlarFotogramas()
    montar({ alGuardar, pasoInicial: 1 }) // se abre en «Detalle» con «Datos» sin llenar
    expect(screen.getByText('Paso 2 de 2 · Detalle')).toBeInTheDocument()
    await u.click(guardar())

    expect(await screen.findByText('Paso 1 de 2 · Datos')).toBeInTheDocument()
    expect(nombre()).toHaveAccessibleDescription('Escribe el nombre.')
    await act(async () => {}) // efectos del cambio de paso ya aplicados
    fotogramas.pasar() // el paso ya está pintado: el siguiente fotograma enfoca el campo
    expect(nombre()).toHaveFocus()
    expect(alGuardar).not.toHaveBeenCalled()
  })

  // BUG 2 (src/components/ui/useFormulario.ts → enfocar · FormPasos.tsx → guardar): al guardar con el error en un paso
  // anterior, enfocar() solo espera 5 fotogramas (~83 ms) a que ese paso se pinte; si tarda más (equipo lento o
  // cargado) se rinde y el efecto de cambio de paso deja el foco en el encabezado «Paso 1 de 2», no en el campo.
  // Corregido: enfocar() reintenta por tiempo y FormPasos no enfoca el encabezado si el cambio de paso viene de un error.
  it('si el paso con el error tarda más de 5 fotogramas en pintarse, el foco queda en el campo inválido', async () => {
    const fotogramas = controlarFotogramas()
    montar({ pasoInicial: 1 })
    fireEvent.click(guardar()) // síncrono: React aún no pintó el paso 1
    fotogramas.pasar() // pasan 5 fotogramas sin que exista el campo: enfocar() se rinde
    expect(await screen.findByText('Paso 1 de 2 · Datos')).toBeInTheDocument()
    await act(async () => {})
    fotogramas.pasar()
    expect(nombre()).toHaveFocus() // obtenido: el <p> del encabezado del paso
  })

  it('con todo válido llama a alGuardar una vez con los valores y descarta el borrador', async () => {
    const u = userEvent.setup()
    const alGuardar = vi.fn(async () => ({ ok: true }))
    montar({ alGuardar })
    await pasarPaso1(u)
    await u.type(notas(), 'Todo en orden')
    await u.click(acepta())
    await u.click(screen.getByRole('radio', { name: 'Media' }))
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toContain('Todo en orden') // mientras se escribe, hay borrador
    await u.click(guardar())

    await waitFor(() => expect(alGuardar).toHaveBeenCalledOnce())
    expect(alGuardar).toHaveBeenCalledWith({ nombre: 'Ana María', correo: 'ana@correo.do', notas: 'Todo en orden', acepta: true, prioridad: 'media' })
    await waitFor(() => expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull()) // guardado: se descarta el borrador
  })

  it('los errores que devuelve el servicio salen junto a su campo, llevan al paso donde está y enfocan el campo', async () => {
    const u = userEvent.setup()
    const alGuardar = vi.fn(async () => ({ ok: false, errores: { correo: 'Ese correo ya está registrado.' } }))
    const fotogramas = controlarFotogramas()
    montar({ alGuardar })
    await pasarPaso1(u)
    await u.type(notas(), 'Todo en orden')
    await u.click(acepta())
    await u.click(screen.getByRole('radio', { name: 'Baja' }))
    await u.click(guardar())

    expect(await screen.findByText('Paso 1 de 2 · Datos')).toBeInTheDocument()
    expect(correo()).toHaveAccessibleDescription('Ese correo ya está registrado.')
    await act(async () => {})
    fotogramas.pasar()
    expect(correo()).toHaveFocus()
    expect(correo()).toHaveValue('ana@correo.do') // lo escrito sigue ahí
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).not.toBeNull() // no se guardó: el borrador se mantiene

    // Al corregir el campo, el error del servicio desaparece.
    await u.type(correo(), 'x')
    expect(correo()).not.toHaveAttribute('aria-invalid')
  })

  it('guardarDeshabilitado deshabilita «Guardar» en el último paso y explica por qué', async () => {
    const u = userEvent.setup()
    montar({ guardarDeshabilitado: true })
    expect(siguiente()).toBeEnabled() // los pasos intermedios siguen funcionando sin conexión
    await pasarPaso1(u)

    expect(guardar()).toBeDisabled()
    expect(guardar()).toHaveAccessibleDescription('Sin conexión: no se puede guardar.')
    expect(screen.getByText('Sin conexión: no se puede guardar.')).toHaveAttribute('role', 'status')
  })
})

describe('useFormulario · validación por campo', () => {
  it('un campo se valida al salir de él (no mientras se escribe) y el error se va al corregirlo', async () => {
    const u = userEvent.setup()
    montar()
    await u.type(correo(), 'abc')
    expect(correo()).not.toHaveAttribute('aria-invalid')
    await u.tab()
    expect(correo()).toHaveAccessibleDescription('El correo no es válido.')

    await u.type(correo(), '@x.do')
    expect(correo()).not.toHaveAttribute('aria-invalid')
  })

  it('cada error está pegado a su campo (aria-invalid + aria-describedby al mensaje con role="alert")', async () => {
    const u = userEvent.setup()
    montar()
    await u.click(siguiente())
    const mensaje = screen.getByText('Escribe el nombre.').closest('p')
    expect(mensaje).toHaveAttribute('role', 'alert')
    expect(nombre().getAttribute('aria-describedby')).toBe(mensaje?.id)
  })
})

describe('useFormulario · borrador', () => {
  it('lo escrito se recupera al desmontar y volver a montar, con el aviso «Recuperamos lo que estabas escribiendo»', async () => {
    const u = userEvent.setup()
    const primera = montar()
    await u.type(nombre(), 'Ana María')
    await u.type(correo(), 'ana@')
    primera.unmount()

    montar()
    expect(screen.getByText('Recuperamos lo que estabas escribiendo.').closest('[role="status"]')).not.toBeNull()
    expect(nombre()).toHaveValue('Ana María')
    expect(correo()).toHaveValue('ana@')
  })

  it('«Seguir editando» cierra el aviso sin tocar lo escrito', async () => {
    const u = userEvent.setup()
    const primera = montar()
    await u.type(nombre(), 'Ana')
    primera.unmount()

    montar()
    await u.click(screen.getByRole('button', { name: 'Seguir editando' }))
    expect(screen.queryByText('Recuperamos lo que estabas escribiendo.')).not.toBeInTheDocument()
    expect(nombre()).toHaveValue('Ana')
  })

  it('«Descartar» vuelve a los valores iniciales, borra el borrador y avisa con un mensaje', async () => {
    const u = userEvent.setup()
    const primera = montar()
    await u.type(nombre(), 'Ana')
    await u.type(correo(), 'ana@correo.do')
    primera.unmount()

    montar()
    await u.click(screen.getByRole('button', { name: 'Descartar el borrador y empezar de nuevo' }))
    expect(screen.queryByText('Recuperamos lo que estabas escribiendo.')).not.toBeInTheDocument()
    expect(nombre()).toHaveValue('')
    expect(correo()).toHaveValue('')
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull()
    expect(await screen.findByText('Se descartó el borrador.')).toBeInTheDocument()
  })

  it('un formulario que se abre y se cierra sin escribir no deja borrador ni aviso la próxima vez', () => {
    const primera = montar()
    primera.unmount()
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull()

    montar()
    expect(screen.queryByText('Recuperamos lo que estabas escribiendo.')).not.toBeInTheDocument()
  })

  it('los campos excluidos del borrador (como una contraseña) no se guardan ni se recuperan', async () => {
    const u = userEvent.setup()
    const primera = montar({ excluirDeBorrador: ['correo'] })
    await u.type(nombre(), 'Ana')
    await u.type(correo(), 'secreto@correo.do')
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).not.toContain('secreto')
    primera.unmount()

    montar({ excluirDeBorrador: ['correo'] })
    expect(nombre()).toHaveValue('Ana')
    expect(correo()).toHaveValue('')
  })
})

/** Harness mínimo: TextareaAbreviado controlado, como lo usan los formularios reales. */
function Notas({ maxLength, botonProcesar }: { maxLength?: number; botonProcesar?: boolean }) {
  const [valor, setValor] = useState('')
  return <TextareaAbreviado label="Observaciones" value={valor} onValueChange={setValor} maxLength={maxLength} botonProcesar={botonProcesar} />
}
const montarNotas = (props: { maxLength?: number; botonProcesar?: boolean } = {}) =>
  render(
    <ToastProvider>
      <Notas {...props} />
    </ToastProvider>,
  )
const area = () => screen.getByLabelText(/^Observaciones/)

describe('TextareaAbreviado · abreviaturas', () => {
  it('expande la sigla al escribir un espacio después de ella', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.type(area(), 'pa ')
    expect(area()).toHaveValue('presión arterial ')
  })

  it('expande también con un signo de puntuación y conserva la mayúscula inicial', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.type(area(), 'Toma de meds, ')
    expect(area()).toHaveValue('Toma de medicamentos, ')
    await u.type(area(), 'Hta ')
    expect(area()).toHaveValue('Toma de medicamentos, Hipertensión ')
  })

  it('no toca palabras que no son siglas ni siglas que van pegadas a otra palabra o número', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.type(area(), 'hola 120pa pasa ')
    expect(area()).toHaveValue('hola 120pa pasa ')
  })

  it('no expande si el texto pasaría del máximo de caracteres', async () => {
    const u = userEvent.setup()
    montarNotas({ maxLength: 10 })
    await u.type(area(), 'pa ') // «presión arterial » son 17 caracteres
    expect(area()).toHaveValue('pa ')
  })

  it('ofrece sugerencias al escribir el comienzo de una sigla y al elegir una se expande', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.type(area(), 'me')

    const lista = await screen.findByRole('listbox', { name: 'Sugerencias de abreviaturas' })
    expect(lista).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'med: medicamento' })).toBeInTheDocument()
    await u.click(screen.getByRole('option', { name: 'meds: medicamentos' }))

    await waitFor(() => expect(area()).toHaveValue('medicamentos '))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Esc cierra las sugerencias sin cambiar el texto', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.type(area(), 'me')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(area()).toHaveValue('me')
  })

  it('«Procesar abreviaturas» expande todas las siglas de un texto pegado y avisa cuántas fueron', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.click(area())
    await u.paste('sn, hta y meds al día') // pegado: no se expande al escribir
    expect(area()).toHaveValue('sn, hta y meds al día')

    await u.click(screen.getByRole('button', { name: 'Procesar abreviaturas' }))
    await waitFor(() => expect(area()).toHaveValue('sin novedad, hipertensión y medicamentos al día'))
    expect(await screen.findByText('Se expandieron 3 abreviaturas.')).toBeInTheDocument()
  })

  it('«Procesar abreviaturas» avisa si no hay nada que expandir y no cambia el texto', async () => {
    const u = userEvent.setup()
    montarNotas()
    await u.type(area(), 'Todo bien hoy')
    await u.click(screen.getByRole('button', { name: 'Procesar abreviaturas' }))

    expect(await screen.findByText('No encontramos abreviaturas para expandir en el texto.')).toBeInTheDocument()
    expect(area()).toHaveValue('Todo bien hoy')
  })

  it('el botón «Procesar abreviaturas» se puede ocultar (botonProcesar={false})', () => {
    montarNotas({ botonProcesar: false })
    expect(screen.queryByRole('button', { name: 'Procesar abreviaturas' })).not.toBeInTheDocument()
  })

  it('la lista de abreviaturas está en la ayuda en línea del campo', async () => {
    const u = userEvent.setup()
    montarNotas()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument() // la ayuda empieza cerrada
    await u.click(screen.getByRole('button', { name: 'Ayuda: Observaciones' }))
    const ayuda = await screen.findByRole('tooltip')
    expect(ayuda).toHaveTextContent('Abreviaturas disponibles')
    expect(ayuda).toHaveTextContent('pa → presión arterial')
    expect(ayuda).toHaveTextContent('hta → hipertensión')
  })
})
