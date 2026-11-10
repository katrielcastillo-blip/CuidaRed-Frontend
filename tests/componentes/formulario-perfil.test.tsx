/*
 * formulario-perfil.test.tsx — Pruebas de componente del perfil propio (CU-01 «Actualizar perfil» · HU-01 · RF-1.4 ·
 * SRS §8.2.2.1.22 «sin perder lo escrito» · SRS §8.2.2.3.5 b · CR-188): «Editar perfil» (validación por campo,
 * guardado en el store, borrador, botón deshabilitado con explicación sin conexión) y el panel «Cambiar contraseña»
 * (requisitos en vivo —incluido el carácter especial—, error con la contraseña actual incorrecta y éxito).
 * Módulo: pruebas · perfil (src/features/perfil/pages/EditarPerfil.tsx y components/CambiarPassword.tsx).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui'
import { setSimularSinConexion } from '@/domain/conectividad'
import { DEMO_PASSWORD } from '@/domain/seed'
import { verificarSecreto } from '@/domain/seguridad'
import { abrirSesion, cerrarSesionLocal } from '@/domain/sesion'
import { getDB, resetDemo } from '@/domain/store'
import EditarPerfil from '@/features/perfil/pages/EditarPerfil'

// useShell() entrega por defecto base «/»; en la app real la da AppShell del rol. Se fija la del área del cuidador
// para que los enlaces y navigate() de las pantallas apunten a rutas válidas (el resto de AppShell queda igual).
vi.mock('@/layouts/AppShell', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/layouts/AppShell')>()),
  useShell: () => ({ base: '/cuidador', perfilPath: '/cuidador/perfil' }),
}))

const CLAVE_BORRADOR = 'cuidared:borrador:mi-perfil:u-cuid'
const NUEVA = 'NuevaClave2026!'

type Ev = ReturnType<typeof userEvent.setup>

/** «Editar perfil» como lo monta perfilRoutes(); lo que viene después de guardar (navigate) cae en la ruta comodín. */
function abrir() {
  const router = createMemoryRouter(
    [
      { path: '/perfil/editar', element: <EditarPerfil /> },
      { path: '*', element: <p>Destino tras guardar</p> },
    ],
    { initialEntries: ['/perfil/editar'] },
  )
  return render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
}

const yo = () => getDB().usuarios.find((x) => x.id === 'u-cuid')!
const nombre = () => screen.getByLabelText(/^Nombre/)
const apellido = () => screen.getByLabelText(/^Apellidos/)
const telefono = () => screen.getByLabelText(/^Teléfono/)
const guardarCambios = () => screen.getByRole('button', { name: 'Guardar cambios' })

/** Abre el panel «Cambiar contraseña» desde la fila «Contraseña» y devuelve el diálogo. */
async function abrirPanelPassword(u: Ev) {
  await u.click(await screen.findByRole('button', { name: 'Cambiar' }))
  return screen.findByRole('dialog', { name: 'Cambiar contraseña' })
}
const campoPassword = (dialogo: HTMLElement, etiqueta: RegExp) => within(dialogo).getByLabelText(etiqueta)
const guardarPassword = (dialogo: HTMLElement) => within(dialogo).getByRole('button', { name: 'Guardar' })

async function escribirPasswords(u: Ev, dialogo: HTMLElement, actual: string, nueva: string, confirmar = nueva) {
  if (actual) await u.type(campoPassword(dialogo, /^Contraseña actual/), actual)
  if (nueva) await u.type(campoPassword(dialogo, /^Nueva contraseña/), nueva)
  if (confirmar) await u.type(campoPassword(dialogo, /^Confirmar nueva contraseña/), confirmar)
}

/** Lo que el panel marca para un requisito: «(cumplido)» o «(pendiente)» (texto para lectores de pantalla). */
const requisito = (dialogo: HTMLElement, texto: string) => within(dialogo).getByText(texto).closest('li') as HTMLElement

/** localStorage en memoria, para los entornos donde el de Node 25 (webstorage sin archivo) no tiene métodos. */
function almacenEnMemoria(): Storage {
  const datos = new Map<string, string>()
  return {
    get length() {
      return datos.size
    },
    clear: () => datos.clear(),
    getItem: (k: string) => datos.get(k) ?? null,
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => void datos.delete(k),
    setItem: (k: string, v: string) => void datos.set(k, String(v)),
  }
}

let almacenBueno: Storage

beforeAll(() => {
  // jsdom no implementa scrollIntoView y los formularios lo usan al enfocar el primer campo inválido.
  Element.prototype.scrollIntoView = () => undefined
  // En Node ≥ 25 el localStorage global no funciona: sin esto el aviso de «volver la conexión» (que relee el
  // almacenamiento) no llegaría a la pantalla. En CI (Node 24) se usa el de jsdom y este paso no hace nada.
  if (typeof localStorage.getItem !== 'function') vi.stubGlobal('localStorage', almacenEnMemoria())
  almacenBueno = localStorage
})

beforeEach(() => {
  setSimularSinConexion(false)
  cerrarSesionLocal()
  localStorage.clear()
  sessionStorage.clear()
  resetDemo()
  abrirSesion('u-cuid', 'm-3') // Carlos Ruiz · 829 777 9865 · cédula 001-8755156-2
})

describe('Editar perfil · datos', () => {
  it('muestra mis datos; el correo y la cédula son de solo lectura y explican a quién acudir', async () => {
    abrir()
    expect(await screen.findByLabelText(/^Nombre/)).toHaveValue('Carlos')
    expect(apellido()).toHaveValue('Ruiz')
    expect(telefono()).toHaveValue('829 777 9865')

    const correo = screen.getByLabelText(/^Correo electrónico/)
    expect(correo).toHaveValue('cuidador@cuidared.do')
    expect(correo).toHaveAttribute('readonly')
    expect(correo).toHaveAccessibleDescription(/no se cambia desde aquí.*al administrador de tu organización/)
    const cedula = screen.getByLabelText(/^Cédula/)
    expect(cedula).toHaveValue('001-8755156-2')
    expect(cedula).toHaveAttribute('readonly')
    expect(cedula).toHaveAccessibleDescription(/contacta al administrador de tu organización/)
  })

  it('el teléfono se da formato mientras se escribe', async () => {
    const u = userEvent.setup()
    abrir()
    await u.clear(await screen.findByLabelText(/^Teléfono/))
    await u.type(telefono(), '8095550100')
    expect(telefono()).toHaveValue('809 555 0100')
  })
})

describe('Editar perfil · validación', () => {
  it('al guardar con datos inválidos muestra cada error junto a su campo y enfoca el primero', async () => {
    const u = userEvent.setup()
    abrir()
    await u.clear(await screen.findByLabelText(/^Nombre/))
    await u.clear(apellido())
    await u.clear(telefono())
    await u.type(telefono(), '8297') // incompleto
    await u.click(guardarCambios())

    expect(nombre()).toHaveAttribute('aria-invalid', 'true')
    expect(nombre()).toHaveAccessibleDescription('Escribe el nombre.')
    expect(apellido()).toHaveAttribute('aria-invalid', 'true')
    expect(apellido()).toHaveAccessibleDescription('Escribe el apellido.')
    expect(telefono()).toHaveAttribute('aria-invalid', 'true')
    expect(telefono()).toHaveAccessibleDescription('Usa 10 dígitos, ej. 809 555 0100.')
    await waitFor(() => expect(nombre()).toHaveFocus())
    // Nada se guardó.
    expect(yo()).toMatchObject({ nombre: 'Carlos', apellido: 'Ruiz', telefono: '829 777 9865' })
  })

  it('cada campo se valida al salir de él: el nombre con números se rechaza y el error se va al corregir', async () => {
    const u = userEvent.setup()
    abrir()
    const campo = await screen.findByLabelText(/^Nombre/)
    await u.type(campo, '2')
    expect(campo).not.toHaveAttribute('aria-invalid') // todavía no salió del campo
    await u.tab()
    expect(campo).toHaveAccessibleDescription('El nombre solo puede contener letras.')

    await u.clear(campo)
    await u.type(campo, 'Carlos')
    expect(campo).not.toHaveAttribute('aria-invalid')
  })

  it('el foco va al primer campo inválido aunque no sea el primero de la pantalla (solo el teléfono falla)', async () => {
    const u = userEvent.setup()
    abrir()
    await u.clear(await screen.findByLabelText(/^Teléfono/))
    await u.click(guardarCambios())

    expect(nombre()).not.toHaveAttribute('aria-invalid')
    expect(telefono()).toHaveAccessibleDescription('Escribe el teléfono.')
    await waitFor(() => expect(telefono()).toHaveFocus())
  })
})

describe('Editar perfil · guardado y borrador', () => {
  it('guarda los cambios en el store, avisa y vuelve al perfil', async () => {
    const u = userEvent.setup()
    abrir()
    await u.clear(await screen.findByLabelText(/^Nombre/))
    await u.type(nombre(), 'Carlos Alberto')
    await u.clear(telefono())
    await u.type(telefono(), '8095550100')
    await u.click(guardarCambios())

    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
    expect(await screen.findByText('Destino tras guardar')).toBeInTheDocument()
    expect(yo()).toMatchObject({ nombre: 'Carlos Alberto', apellido: 'Ruiz', telefono: '809 555 0100', email: 'cuidador@cuidared.do', cedula: '001-8755156-2' })
    expect(getDB().auditoria.some((a) => a.accion === 'usuario.editar' && a.registroId === 'u-cuid' && /nombre, teléfono/.test(a.detalle ?? ''))).toBe(true)
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull() // guardado: ya no hay borrador
  })

  it('lo escrito se recupera al volver a abrir el formulario; «Cancelar» lo descarta', async () => {
    const u = userEvent.setup()
    const primera = abrir()
    await u.clear(await screen.findByLabelText(/^Apellidos/))
    await u.type(apellido(), 'Ruiz Peña')
    primera.unmount()
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toContain('Ruiz Peña')

    const segunda = abrir()
    expect(await screen.findByText('Recuperamos lo que estabas escribiendo.')).toBeInTheDocument()
    expect(apellido()).toHaveValue('Ruiz Peña')
    expect(yo().apellido).toBe('Ruiz') // el store no cambió: solo era un borrador

    await u.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull()
    segunda.unmount()
    abrir()
    expect(await screen.findByLabelText(/^Apellidos/)).toHaveValue('Ruiz')
    expect(screen.queryByText('Recuperamos lo que estabas escribiendo.')).not.toBeInTheDocument()
  })
})

describe('Editar perfil · sin conexión', () => {
  it('el botón Guardar queda deshabilitado, explica por qué y lo escrito se conserva', async () => {
    const u = userEvent.setup()
    setSimularSinConexion(true)
    abrir()
    const guardar = await screen.findByRole('button', { name: 'Guardar cambios' })

    expect(guardar).toBeDisabled()
    expect(screen.getByText(/Sin conexión: tus cambios se conservan en este formulario, pero solo podrás guardarlos cuando vuelvas a tener internet/)).toBeInTheDocument()
    expect(guardar).toHaveAccessibleDescription(/Sin conexión: tus cambios se conservan en este formulario/)

    // Se puede seguir editando; pulsar el botón deshabilitado no guarda nada.
    await u.clear(nombre())
    await u.type(nombre(), 'Carlitos')
    await u.click(guardar)
    expect(nombre()).toHaveValue('Carlitos')
    expect(screen.queryByText('Cambios guardados')).not.toBeInTheDocument()
    expect(yo().nombre).toBe('Carlos')
  })

  it('al volver la conexión el botón se habilita, el aviso desaparece y se puede guardar', async () => {
    const u = userEvent.setup()
    setSimularSinConexion(true)
    abrir()
    await u.clear(await screen.findByLabelText(/^Nombre/))
    await u.type(nombre(), 'Carlitos')
    expect(guardarCambios()).toBeDisabled()

    act(() => setSimularSinConexion(false))
    expect(guardarCambios()).toBeEnabled()
    expect(guardarCambios()).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByText(/Sin conexión: tus cambios se conservan/)).not.toBeInTheDocument()

    await u.click(guardarCambios())
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument()
    expect(yo().nombre).toBe('Carlitos')
  })
})

describe('Editar perfil · almacenamiento bloqueado', () => {
  // BUG 1 (src/domain/store.ts → releerServidor): el valor por defecto `raw = localStorage.getItem(KEY)` se evalúa fuera
  // del try. Con el almacenamiento bloqueado (SecurityError: modo privado, datos de sitio bloqueados; en Node 25 el
  // localStorage global sin archivo) lanza al volver la conexión, y como conectividad.ts → emitir() avisa a los
  // suscriptores en un forEach sin proteger, la pantalla nunca se entera. Esperado: el botón Guardar se habilita.
  // Obtenido: sigue deshabilitado con el aviso «Sin conexión». Quita el skip al corregirlo.
  it('con el almacenamiento bloqueado, al volver la conexión la pantalla se entera (Guardar habilitado)', async () => {
    const bloqueado: Storage = {
      ...almacenEnMemoria(),
      getItem: () => {
        throw new DOMException('Acceso denegado', 'SecurityError')
      },
    }
    setSimularSinConexion(true)
    abrir()
    expect(await screen.findByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    vi.stubGlobal('localStorage', bloqueado)
    try {
      act(() => {
        try {
          setSimularSinConexion(false)
        } catch {
          /* releerServidor lanza antes de avisar a la pantalla */
        }
      })
      expect(guardarCambios()).toBeEnabled()
    } finally {
      vi.stubGlobal('localStorage', almacenBueno)
    }
  })
})

describe('Cambiar contraseña · requisitos en vivo', () => {
  it('los cinco requisitos y la coincidencia empiezan pendientes y se marcan al escribir; el carácter especial es el último', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await abrirPanelPassword(u)
    const textos = ['Al menos 8 caracteres', 'Una letra mayúscula', 'Una letra minúscula', 'Un número', 'Un carácter especial (por ejemplo ! @ # $)', 'Ambas contraseñas coinciden']
    for (const t of textos) expect(requisito(dialogo, t)).toHaveTextContent('(pendiente)')

    const nueva = campoPassword(dialogo, /^Nueva contraseña/)
    await u.type(nueva, 'Abcdefg1') // todo menos el carácter especial
    for (const t of textos.slice(0, 4)) expect(requisito(dialogo, t)).toHaveTextContent('(cumplido)')
    expect(requisito(dialogo, textos[4]!)).toHaveTextContent('(pendiente)')
    expect(requisito(dialogo, textos[5]!)).toHaveTextContent('(pendiente)')

    await u.type(nueva, '#')
    expect(requisito(dialogo, textos[4]!)).toHaveTextContent('(cumplido)')

    await u.type(campoPassword(dialogo, /^Confirmar nueva contraseña/), 'Abcdefg1#')
    expect(requisito(dialogo, textos[5]!)).toHaveTextContent('(cumplido)')
    // Si la confirmación deja de coincidir, vuelve a pendiente.
    await u.type(campoPassword(dialogo, /^Confirmar nueva contraseña/), 'x')
    expect(requisito(dialogo, textos[5]!)).toHaveTextContent('(pendiente)')
  })

  it.each([
    ['sin mayúscula', 'abcdefg1!', 'Una letra mayúscula'],
    ['sin minúscula', 'ABCDEFG1!', 'Una letra minúscula'],
    ['sin número', 'Abcdefgh!', 'Un número'],
    ['sin carácter especial', 'Abcdefg12', 'Un carácter especial (por ejemplo ! @ # $)'],
    ['demasiado corta', 'Ab1!', 'Al menos 8 caracteres'],
  ])('una contraseña %s deja pendiente solo ese requisito', async (_caso, password, pendiente) => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await abrirPanelPassword(u)
    await u.type(campoPassword(dialogo, /^Nueva contraseña/), password)

    const base = ['Al menos 8 caracteres', 'Una letra mayúscula', 'Una letra minúscula', 'Un número', 'Un carácter especial (por ejemplo ! @ # $)']
    for (const t of base) expect(requisito(dialogo, t)).toHaveTextContent(t === pendiente ? '(pendiente)' : '(cumplido)')
  })
})

describe('Cambiar contraseña · validación y servicio', () => {
  it('sin completar nada muestra los errores junto a cada campo y enfoca la contraseña actual', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await abrirPanelPassword(u)
    await u.click(guardarPassword(dialogo))

    expect(campoPassword(dialogo, /^Contraseña actual/)).toHaveAccessibleDescription('Escribe tu contraseña actual.')
    expect(campoPassword(dialogo, /^Nueva contraseña/)).toHaveAccessibleDescription('Escribe la nueva contraseña.')
    expect(campoPassword(dialogo, /^Confirmar nueva contraseña/)).toHaveAccessibleDescription('Confirma la contraseña.')
    await waitFor(() => expect(campoPassword(dialogo, /^Contraseña actual/)).toHaveFocus())
  })

  it('una nueva contraseña sin carácter especial se rechaza junto al campo y no cambia nada', async () => {
    const u = userEvent.setup()
    abrir()
    const hashAntes = yo().passwordHash
    const dialogo = await abrirPanelPassword(u)
    await escribirPasswords(u, dialogo, DEMO_PASSWORD, 'Abcdefg12')
    await u.click(guardarPassword(dialogo))

    const nueva = campoPassword(dialogo, /^Nueva contraseña/)
    expect(nueva).toHaveAccessibleDescription('La contraseña aún no cumple todos los requisitos de la lista.')
    await waitFor(() => expect(nueva).toHaveFocus())
    expect(yo().passwordHash).toBe(hashAntes)
  })

  it('una confirmación distinta se señala junto a su campo', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await abrirPanelPassword(u)
    await escribirPasswords(u, dialogo, DEMO_PASSWORD, NUEVA, 'OtraClave2026!')
    await u.click(guardarPassword(dialogo))

    expect(campoPassword(dialogo, /^Confirmar nueva contraseña/)).toHaveAccessibleDescription('Las contraseñas no coinciden.')
  })

  it('la nueva contraseña debe ser distinta de la actual', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await abrirPanelPassword(u)
    await escribirPasswords(u, dialogo, 'Demo1234!', 'Demo1234!')
    await u.click(guardarPassword(dialogo))

    expect(campoPassword(dialogo, /^Nueva contraseña/)).toHaveAccessibleDescription('La nueva contraseña debe ser distinta de la actual.')
  })

  it('con la contraseña actual incorrecta el error del servicio aparece junto a ese campo, con el foco, y el panel sigue abierto', async () => {
    const u = userEvent.setup()
    abrir()
    const hashAntes = yo().passwordHash
    const dialogo = await abrirPanelPassword(u)
    await escribirPasswords(u, dialogo, 'ClaveIncorrecta1!', NUEVA)
    await u.click(guardarPassword(dialogo))

    const actual = campoPassword(dialogo, /^Contraseña actual/)
    await waitFor(() => expect(actual).toHaveAccessibleDescription('La contraseña actual no es correcta.'))
    expect(actual).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(actual).toHaveFocus())
    expect(screen.getByRole('dialog', { name: 'Cambiar contraseña' })).toBeInTheDocument()
    expect(screen.queryByText('Contraseña actualizada')).not.toBeInTheDocument()
    expect(yo().passwordHash).toBe(hashAntes)
    // Lo demás que se escribió se conserva para reintentar.
    expect(campoPassword(dialogo, /^Nueva contraseña/)).toHaveValue(NUEVA)

    // Corrige solo la actual y el cambio se aplica.
    await u.clear(actual)
    await u.type(actual, DEMO_PASSWORD)
    await u.click(guardarPassword(dialogo))
    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
  })

  it('un cambio válido actualiza la contraseña guardada (hash), la audita y cierra el panel', async () => {
    const u = userEvent.setup()
    abrir()
    const antes = yo()
    const dialogo = await abrirPanelPassword(u)
    await escribirPasswords(u, dialogo, DEMO_PASSWORD, NUEVA)
    await u.click(guardarPassword(dialogo))

    expect(await screen.findByText('Contraseña actualizada')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Cambiar contraseña' })).not.toBeInTheDocument())
    const despues = yo()
    expect(despues.passwordHash).not.toBe(antes.passwordHash)
    expect(await verificarSecreto(NUEVA, despues.passwordSalt, despues.passwordHash)).toBe(true)
    expect(await verificarSecreto(DEMO_PASSWORD, despues.passwordSalt, despues.passwordHash)).toBe(false)
    expect(getDB().auditoria.some((a) => a.accion === 'usuario.password' && a.registroId === 'u-cuid')).toBe(true)
  })
})

describe('Cambiar contraseña · seguridad y conexión', () => {
  it('las contraseñas nunca se guardan como borrador', async () => {
    const u = userEvent.setup()
    abrir()
    const dialogo = await abrirPanelPassword(u)
    await escribirPasswords(u, dialogo, DEMO_PASSWORD, NUEVA)

    for (let i = 0; i < sessionStorage.length; i++) {
      const contenido = sessionStorage.getItem(sessionStorage.key(i)!) ?? ''
      expect(contenido).not.toContain(NUEVA)
      expect(contenido).not.toContain(DEMO_PASSWORD)
    }

    // Al cerrar y volver a abrir el panel queda vacío y sin aviso de «recuperado».
    await u.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    const otra = await abrirPanelPassword(u)
    expect(campoPassword(otra, /^Contraseña actual/)).toHaveValue('')
    expect(campoPassword(otra, /^Nueva contraseña/)).toHaveValue('')
    expect(screen.queryByText('Recuperamos lo que estabas escribiendo.')).not.toBeInTheDocument()
  })

  it('sin conexión el botón Guardar del panel queda deshabilitado, lo explica y lo escrito se conserva', async () => {
    const u = userEvent.setup()
    setSimularSinConexion(true)
    abrir()
    const dialogo = await abrirPanelPassword(u)

    expect(guardarPassword(dialogo)).toBeDisabled()
    expect(within(dialogo).getByText(/Sin conexión: necesitas internet para cambiar tu contraseña/)).toBeInTheDocument()
    await u.type(campoPassword(dialogo, /^Nueva contraseña/), NUEVA)
    expect(campoPassword(dialogo, /^Nueva contraseña/)).toHaveValue(NUEVA)
    await u.click(guardarPassword(dialogo))
    expect(screen.queryByText('Contraseña actualizada')).not.toBeInTheDocument()
  })
})
