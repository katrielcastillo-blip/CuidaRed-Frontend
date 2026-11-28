/*
 * marco-ayuda.test.tsx — Pruebas de componente de la ayuda del marco conectado: «Contactar soporte» (con y sin
 * VITE_CONTACTO_EMAIL; sin él no se abre ningún correo) y «Tamaño del texto» de Accesibilidad (font-size de <html>,
 * localStorage con try/catch).
 * Módulo: pruebas · access-real/operacion/marco.
 * © 2026 Equipo CuidaRed – INTEC.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  aplicarTamanoTextoGuardado, CLAVE_TAMANO_TEXTO, guardarTamanoTexto, leerTamanoTexto,
} from '@/features/access-real/operacion/marco/accesibilidad'
import { PantallaSoporte } from '@/features/access-real/operacion/marco/pantallas-ayuda'
import { correoConfigurado, enlaceSoporte } from '@/features/access-real/operacion/marco/soporte'

const estado = vi.hoisted(() => ({ correo: null as string | null }))
vi.mock('@/features/access-real/operacion/marco/soporte', async (original) => ({
  ...(await original<typeof import('@/features/access-real/operacion/marco/soporte')>()),
  get CORREO_SOPORTE() { return estado.correo },
}))

describe('correo de soporte', () => {
  it('solo acepta una dirección válida; si falta o es inválida devuelve null (sin dirección inventada)', () => {
    expect(correoConfigurado('soporte@cuidared.org')).toBe('soporte@cuidared.org')
    expect(correoConfigurado('  soporte@cuidared.org ')).toBe('soporte@cuidared.org')
    for (const valor of [undefined, '', '   ', 'sin-arroba', 'a@b', 'a b@c.d', 'a@b.c?subject=x']) expect(correoConfigurado(valor)).toBeNull()
  })

  it('arma el mailto con asunto, tema y cuenta codificados', () => {
    const enlace = enlaceSoporte({ correo: 'soporte@cuidared.org', tema: 'Plan y pagos', asunto: 'No cobra & falla', mensaje: 'Hola\nmundo', cuenta: 'Fundación Esperanza' })
    expect(enlace.startsWith('mailto:soporte@cuidared.org?subject=')).toBe(true)
    const url = new URL(enlace)
    expect(url.searchParams.get('subject')).toBe('[CuidaRed] No cobra & falla')
    expect(url.searchParams.get('body')).toBe('Hola\nmundo\n\n—\nTema: Plan y pagos\nCuenta: Fundación Esperanza')
  })
})

describe('PantallaSoporte', () => {
  const montar = (abrir = vi.fn(), volver = vi.fn()) => {
    render(<MemoryRouter><PantallaSoporte cuenta="Fundación Esperanza" volver={volver} abrir={abrir} /></MemoryRouter>)
    return { abrir, volver }
  }

  it('con el correo configurado abre el mailto con el tema elegido y confirma que el mensaje está listo', async () => {
    estado.correo = 'soporte@cuidared.org'
    const u = userEvent.setup()
    const { abrir, volver } = montar()
    expect(screen.getByRole('radio', { name: 'Algo no funciona' })).toBeChecked()
    await u.click(screen.getByRole('radio', { name: 'Plan y pagos' }))
    await u.type(screen.getByLabelText(/^Asunto/), 'No puedo pagar')
    await u.type(screen.getByLabelText(/^Mensaje/), 'Sale un error al contratar.')
    await u.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    expect(abrir).toHaveBeenCalledTimes(1)
    const url = new URL(abrir.mock.calls[0]![0] as string)
    expect(url.protocol).toBe('mailto:')
    expect(url.pathname).toBe('soporte@cuidared.org')
    expect(url.searchParams.get('body')).toContain('Tema: Plan y pagos')
    expect(screen.getByRole('heading', { name: 'Tu mensaje está listo' })).toBeInTheDocument()
    expect(screen.getByText(/llama al 9-1-1/)).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Finalizar' }))
    expect(volver).toHaveBeenCalled()
  })

  it('con el correo sin configurar muestra el formulario con un aviso y no abre ningún correo', async () => {
    estado.correo = null
    const u = userEvent.setup()
    const { abrir } = montar()
    expect(screen.getByText(/correo de soporte todavía no está configurado/)).toBeInTheDocument()
    await u.type(screen.getByLabelText(/^Asunto/), 'Hola')
    await u.type(screen.getByLabelText(/^Mensaje/), 'Probando')
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled()
    await u.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
    expect(abrir).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Tu mensaje está listo' })).not.toBeInTheDocument()
  })
})

/** localStorage en memoria: el de Node 25 (webstorage sin archivo) no tiene métodos (ver formulario-perfil.test.tsx). */
function almacenEnMemoria(): Storage {
  const datos = new Map<string, string>()
  return {
    get length() { return datos.size },
    clear: () => datos.clear(),
    getItem: (k: string) => datos.get(k) ?? null,
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => void datos.delete(k),
    setItem: (k: string, v: string) => void datos.set(k, String(v)),
  }
}

describe('Tamaño del texto (Accesibilidad)', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', almacenEnMemoria()) })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.style.fontSize = ''
  })

  it('Normal = sin estilo; Grande 112,5 % y Muy grande 125 % se aplican a <html> y se guardan', () => {
    guardarTamanoTexto('grande')
    expect(document.documentElement.style.fontSize).toBe('112.5%')
    expect(window.localStorage.getItem(CLAVE_TAMANO_TEXTO)).toBe('grande')
    guardarTamanoTexto('muy-grande')
    expect(document.documentElement.style.fontSize).toBe('125%')
    expect(leerTamanoTexto()).toBe('muy-grande')
    guardarTamanoTexto('normal')
    expect(document.documentElement.style.fontSize).toBe('')
    expect(window.localStorage.getItem(CLAVE_TAMANO_TEXTO)).toBeNull()
  })

  it('al iniciar aplica lo guardado e ignora valores inválidos', () => {
    window.localStorage.setItem(CLAVE_TAMANO_TEXTO, 'muy-grande')
    aplicarTamanoTextoGuardado()
    expect(document.documentElement.style.fontSize).toBe('125%')
    window.localStorage.setItem(CLAVE_TAMANO_TEXTO, '999%')
    expect(leerTamanoTexto()).toBe('normal')
  })

  it('si localStorage falla (modo privado) no lanza error y el tamaño se aplica igual', () => {
    const bloqueado = () => { throw new Error('bloqueado') }
    vi.stubGlobal('localStorage', { getItem: bloqueado, setItem: bloqueado, removeItem: bloqueado })
    expect(leerTamanoTexto()).toBe('normal')
    expect(() => guardarTamanoTexto('grande')).not.toThrow()
    expect(document.documentElement.style.fontSize).toBe('112.5%')
  })
})
