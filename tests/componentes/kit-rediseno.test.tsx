/*
 * kit-rediseno.test.tsx — Pruebas de los componentes del rediseño (Figma «Sistema de diseño»): Aviso, Requisito de
 * contraseña, Opción, Progreso del registro, Casilla, Chip, Avatar, Tarjeta KPI, Fila de lista, Botón y Encabezado público.
 * Comprueban el comportamiento y la accesibilidad (ícono + texto, estados anunciados), no los píxeles.
 * Módulo: pruebas · kit de componentes UI (src/components/ui).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  Aviso,
  Avatar,
  Badge,
  Button,
  Checkbox,
  EncabezadoPublico,
  FilaLista,
  Opcion,
  ProgresoRegistro,
  RequisitoContrasena,
  RequisitosContrasena,
  RiesgoBadge,
  StepBar,
  TarjetaKpi,
  TextField,
} from '@/components/ui'

const enRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Aviso', () => {
  it('el error se anuncia como alert y los demás como status, siempre con ícono (aria-hidden) y texto', () => {
    render(
      <>
        <Aviso tipo="error">Algo falló</Aviso>
        <Aviso tipo="exito">Guardado</Aviso>
        <Aviso>Información</Aviso>
      </>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Algo falló')
    expect(screen.getAllByRole('status')).toHaveLength(2)
    for (const caja of [screen.getByRole('alert'), ...screen.getAllByRole('status')]) {
      expect(caja.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }
  })
})

describe('Requisito de contraseña', () => {
  it('pendiente y cumplido se dicen también con texto para lectores de pantalla', () => {
    render(
      <ul>
        <RequisitoContrasena cumplido>Una letra mayúscula</RequisitoContrasena>
        <RequisitoContrasena cumplido={false}>Un número</RequisitoContrasena>
      </ul>,
    )
    expect(screen.getByText('(cumplido)', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('(pendiente)', { exact: false })).toBeInTheDocument()
  })

  it('la lista cuenta los requisitos cumplidos en vivo', () => {
    function Prueba() {
      const [v, setV] = useState('')
      return (
        <>
          <input aria-label="clave" value={v} onChange={(e) => setV(e.target.value)} />
          <RequisitosContrasena
            requisitos={[
              { id: 'largo', texto: 'Al menos 3 caracteres', cumplido: v.length >= 3 },
              { id: 'num', texto: 'Un número', cumplido: /\d/.test(v) },
            ]}
          />
        </>
      )
    }
    render(<Prueba />)
    expect(screen.getByText('0 de 2 requisitos cumplidos.', { exact: false })).toBeInTheDocument()
    return userEvent.type(screen.getByLabelText('clave'), 'ab1').then(() => {
      expect(screen.getByText('2 de 2 requisitos cumplidos.', { exact: false })).toBeInTheDocument()
    })
  })
})

describe('Opción', () => {
  it('es un botón de alternar: aria-pressed, marca visible al seleccionar y responde al toque', async () => {
    const alTocar = vi.fn()
    const { rerender } = render(
      <Opcion icono="family_home" seleccionada={false} onClick={alTocar}>
        Familia
      </Opcion>,
    )
    const boton = screen.getByRole('button', { name: 'Familia' })
    expect(boton).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(boton)
    expect(alTocar).toHaveBeenCalledTimes(1)
    rerender(
      <Opcion icono="family_home" seleccionada onClick={alTocar}>
        Familia
      </Opcion>,
    )
    expect(screen.getByRole('button', { name: 'Familia' })).toHaveAttribute('aria-pressed', 'true')
    // Además del color, la selección lleva una marca de verificación.
    expect(screen.getByRole('button', { name: 'Familia' }).querySelectorAll('svg').length).toBe(2)
  })

  it('con role="radio" se expone con aria-checked', () => {
    render(
      <Opcion role="radio" seleccionada>
        Organización
      </Opcion>,
    )
    expect(screen.getByRole('radio', { name: 'Organización' })).toBeChecked()
  })
})

describe('Progreso del registro', () => {
  it('muestra «Paso X de N» como texto y una barra con un segmento por paso', () => {
    render(<ProgresoRegistro paso={2} total={5} />)
    expect(screen.getByText('Paso 2 de 5')).toBeInTheDocument()
    const barra = screen.getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuenow', '2')
    expect(barra.children).toHaveLength(5)
    expect(Array.from(barra.children).filter((s) => s.className.includes('bg-blue-principal'))).toHaveLength(2)
  })

  it('StepBar sigue siendo un progressbar accesible sin texto visible', () => {
    render(<StepBar step={1} total={3} />)
    expect(screen.getByRole('progressbar', { name: 'Paso 1 de 3' })).toBeInTheDocument()
    expect(screen.queryByText('Paso 1 de 3')).toBeNull()
  })
})

describe('Casilla (Checkbox)', () => {
  it('sigue siendo un checkbox nativo con su etiqueta, marcable por clic', async () => {
    const alCambiar = vi.fn()
    render(<Checkbox label="Acepto" checked={false} onChange={alCambiar} />)
    const casilla = screen.getByRole('checkbox', { name: 'Acepto' })
    await userEvent.click(casilla)
    expect(alCambiar).toHaveBeenCalled()
  })

  it('con error marca aria-invalid y muestra el mensaje con ícono', () => {
    render(<Checkbox label="Acepto" error="Debes aceptar" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Debes aceptar')
  })
})

describe('Campo (TextField)', () => {
  it('etiqueta siempre visible; el error lleva ícono y texto, y el campo queda inválido', () => {
    render(<TextField label="Correo" error="Escribe un correo válido" defaultValue="" />)
    const campo = screen.getByLabelText('Correo')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveAttribute('aria-describedby')
    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('Escribe un correo válido')
    expect(alerta.querySelector('svg')).not.toBeNull()
  })
})

describe('Chip (Badge) y Avatar', () => {
  it('el Badge conserva el texto junto al color y RiesgoBadge añade ícono y texto para lectores', () => {
    render(
      <>
        <Badge tone="danger">Alta</Badge>
        <RiesgoBadge riesgo="medio" />
      </>,
    )
    expect(screen.getByText('Alta')).toBeInTheDocument()
    expect(screen.getByText('Riesgo')).toHaveClass('sr-only')
    expect(screen.getByText('MEDIO')).toBeInTheDocument()
  })

  it('el Avatar muestra las iniciales (máximo dos)', () => {
    render(<Avatar nombre="Ana Pérez Gómez" />)
    expect(screen.getByText('AP')).toBeInTheDocument()
  })
})

describe('Tarjeta KPI y Fila de lista', () => {
  it('la tarjeta KPI con `to` es un enlace completo con cifra, etiqueta y detalle', () => {
    enRouter(<TarjetaKpi tono="rojo" icono="warning" valor={7} etiqueta="Alertas críticas" detalle="Sin atender" to="/alertas?nivel=alta" />)
    const enlace = screen.getByRole('link', { name: /7.*Alertas críticas.*Sin atender/ })
    expect(enlace).toHaveAttribute('href', '/alertas?nivel=alta')
  })

  it('la variante `tinte` (por defecto) pinta la tarjeta con color y borde; `panel` es blanca, sin borde, con baldosa teñida', () => {
    enRouter(
      <>
        <TarjetaKpi tono="rojo" icono="warning" valor={7} etiqueta="Tinte" to="/a" />
        <TarjetaKpi variante="panel" tono="rojo" icono="warning" valor={7} etiqueta="Alertas abiertas" detalle="Sin atender" to="/alertas" />
        <TarjetaKpi variante="panel" tono="azul" icono="elderly" valor={28} etiqueta="Adultos activos" to="/adultos" />
        <TarjetaKpi variante="panel" tono="ambar" icono="volunteer_activism" valor={5} etiqueta="Necesidades" to="/necesidades" />
        <TarjetaKpi variante="panel" tono="verde" icono="calendar_month" valor="2/4" etiqueta="Visitas de hoy" to="/visitas" />
      </>,
    )
    const tinte = screen.getByRole('link', { name: /7.*Tinte/ })
    expect(tinte).toHaveClass('bg-danger-100', 'border', 'border-danger')

    const panel = screen.getByRole('link', { name: /7.*Alertas abiertas.*Sin atender/ })
    expect(panel).toHaveAttribute('href', '/alertas')
    expect(panel).toHaveClass('bg-surface')
    expect(panel).not.toHaveClass('border', 'bg-danger-100', 'border-danger')
    // Cifra grande y etiqueta atenuada; el detalle no se ve, pero se anuncia.
    expect(within(panel).getByText('7')).toHaveClass('text-pantalla')
    expect(within(panel).getByText('Alertas abiertas')).toHaveClass('text-muted')
    expect(within(panel).getByText('Sin atender')).toHaveClass('sr-only')
    // Baldosa de 40 px teñida por métrica.
    const baldosa = (nombre: RegExp) => screen.getByRole('link', { name: nombre }).querySelector('span[aria-hidden="true"]')
    expect(baldosa(/Alertas abiertas/)).toHaveClass('size-10', 'bg-danger-100', 'text-danger')
    expect(baldosa(/Adultos activos/)).toHaveClass('size-10', 'bg-blue-100', 'text-blue-principal')
    expect(baldosa(/Necesidades/)).toHaveClass('size-10', 'bg-warning-100')
    expect(baldosa(/Visitas de hoy/)).toHaveClass('size-10', 'bg-teal-100')
  })

  it('la tarjeta KPI con onClick es un botón', async () => {
    const alTocar = vi.fn()
    render(<TarjetaKpi tono="verde" icono="check_circle" valor={3} etiqueta="Al día" onClick={alTocar} />)
    await userEvent.click(screen.getByRole('button', { name: /3.*Al día/ }))
    expect(alTocar).toHaveBeenCalled()
  })

  it('la fila de lista enlaza y muestra título, descripción y flecha', () => {
    enRouter(<FilaLista icono="inbox" titulo="Solicitudes" descripcion="Pendientes de revisión" to="/solicitudes" />)
    const enlace = screen.getByRole('link', { name: /Solicitudes.*Pendientes de revisión/ })
    expect(enlace).toHaveAttribute('href', '/solicitudes')
    expect(enlace.querySelectorAll('svg').length).toBe(2)
  })
})

describe('Botón', () => {
  it('por defecto ocupa todo el ancho en móvil; fullWidth={false} lo ajusta al contenido', () => {
    render(
      <>
        <Button>Continuar</Button>
        <Button fullWidth={false}>Cancelar</Button>
        <Button variant="ghost">Omitir</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveClass('w-full', 'md:w-auto', 'min-h-14')
    expect(screen.getByRole('button', { name: 'Cancelar' })).not.toHaveClass('w-full')
    // Texto: enlace subrayado de al menos 48 px.
    expect(screen.getByRole('button', { name: 'Omitir' })).toHaveClass('underline', 'min-h-12')
  })

  it('peligro (danger y danger-soft) usa fondo rojo pálido con borde rojo', () => {
    render(<Button variant="danger">Eliminar</Button>)
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('bg-danger-100', 'border-danger')
  })
})

describe('Encabezado público', () => {
  it('lleva el título como h1 y una flecha de regreso de 48 px con nombre accesible', async () => {
    const alVolver = vi.fn()
    enRouter(<EncabezadoPublico titulo="Crear cuenta" onVolver={alVolver} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeInTheDocument()
    const volver = screen.getByRole('button', { name: 'Volver' })
    expect(volver).toHaveClass('size-12')
    await userEvent.click(volver)
    expect(alVolver).toHaveBeenCalled()
  })

  it('con `volver` la flecha es un enlace y el tono verde usa el degradado verde', () => {
    enRouter(<EncabezadoPublico titulo="Recuperar contraseña" tono="verde" volver="/inicio" />)
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/inicio')
    expect(screen.getByRole('banner')).toHaveClass('bg-grad-encabezado-verde')
  })

  it('sin volver ni onVolver no pinta flecha', () => {
    enRouter(<EncabezadoPublico titulo="Portada" />)
    expect(screen.queryByRole('button', { name: 'Volver' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Volver' })).toBeNull()
  })
})
