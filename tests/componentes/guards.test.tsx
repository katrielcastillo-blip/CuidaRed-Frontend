/*
 * guards.test.tsx — Guards de rutas por rol (RF-09 · CU-10 · RS-014 · CR-188): cada rol entra solo a su área, las
 * pantallas con permiso se bloquean por URL directa y el cambio de cuenta aplica los permisos de la nueva membresía.
 * Módulo: pruebas.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { RequirePermiso, RequireRole } from '@/app/guards'
import { cambiarCuenta } from '@/domain/auth'
import { abrirSesion, cerrarSesionLocal } from '@/domain/sesion'
import { resetDemo } from '@/domain/store'
import type { Rol } from '@/domain/types'

const USUARIO: Record<Rol | 'familia', string> = {
  admin: 'u-admin',
  coordinador: 'u-coord',
  cuidador: 'u-cuid',
  voluntario: 'u-vol',
  familiar: 'u-fam',
  familia: 'u-fcoord',
}

function area(rol: Rol, ruta = '/x') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/inicio" element={<p>Pantalla de inicio de sesión</p>} />
        <Route
          path="*"
          element={
            <RequireRole rol={rol}>
              <p>Contenido del área</p>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function conPermiso(accion: Parameters<typeof RequirePermiso>[0]['accion']) {
  return render(
    <MemoryRouter initialEntries={['/x']}>
      <Routes>
        <Route path="/inicio" element={<p>Pantalla de inicio de sesión</p>} />
        <Route
          path="*"
          element={
            <RequirePermiso accion={accion}>
              <p>Pantalla protegida</p>
            </RequirePermiso>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetDemo()
  cerrarSesionLocal()
})

describe('RequireRole', () => {
  it('sin sesión redirige al inicio de sesión', () => {
    area('admin')
    expect(screen.getByText('Pantalla de inicio de sesión')).toBeInTheDocument()
    expect(screen.queryByText('Contenido del área')).not.toBeInTheDocument()
  })

  const roles: Rol[] = ['admin', 'coordinador', 'cuidador', 'voluntario', 'familiar']
  for (const propio of roles) {
    it(`${propio}: entra a su área y no a las de los demás roles`, () => {
      abrirSesion(USUARIO[propio])
      for (const otro of roles) {
        const { unmount } = area(otro)
        if (otro === propio) expect(screen.getByText('Contenido del área')).toBeInTheDocument()
        else expect(screen.queryByText('Contenido del área')).not.toBeInTheDocument()
        unmount()
      }
    })
  }
})

describe('RequirePermiso', () => {
  it('reportes: el coordinador entra; el voluntario y el familiar quedan bloqueados por URL directa', () => {
    abrirSesion(USUARIO.coordinador)
    const c = conPermiso('reportes:ver')
    expect(screen.getByText('Pantalla protegida')).toBeInTheDocument()
    c.unmount()
    for (const rol of ['voluntario', 'familiar'] as const) {
      abrirSesion(USUARIO[rol])
      const r = conPermiso('reportes:ver')
      expect(screen.queryByText('Pantalla protegida')).not.toBeInTheDocument()
      r.unmount()
    }
  })

  it('gestión de miembros: solo el Administrador en Organización y el Coordinador en Familia (V2)', () => {
    abrirSesion(USUARIO.admin)
    let r = conPermiso('usuarios:gestionar')
    expect(screen.getByText('Pantalla protegida')).toBeInTheDocument()
    r.unmount()
    abrirSesion(USUARIO.coordinador) // Coordinador de una Organización
    r = conPermiso('usuarios:gestionar')
    expect(screen.queryByText('Pantalla protegida')).not.toBeInTheDocument()
    r.unmount()
    abrirSesion(USUARIO.familia) // Coordinadora de una cuenta Familia
    r = conPermiso('usuarios:gestionar')
    expect(screen.getByText('Pantalla protegida')).toBeInTheDocument()
    r.unmount()
  })

  it('el voluntario no accede a necesidades ni a información médica', () => {
    abrirSesion(USUARIO.voluntario)
    for (const accion of ['necesidades:ver', 'indicaciones:ver', 'necesidades:registrar'] as const) {
      const r = conPermiso(accion)
      expect(screen.queryByText('Pantalla protegida')).not.toBeInTheDocument()
      r.unmount()
    }
  })

  it('cambiar de cuenta aplica los permisos de la nueva membresía', () => {
    abrirSesion(USUARIO.familiar) // Clara: familiar en la Fundación y en la Familia Méndez
    const r = conPermiso('familiares:autorizar')
    expect(screen.queryByText('Pantalla protegida')).not.toBeInTheDocument()
    r.unmount()
    act(() => {
      expect(cambiarCuenta('m-12')).toBe('/familiar')
    })
    // Sigue siendo familiar: tampoco puede autorizar familiares en la cuenta Familia.
    const r2 = conPermiso('familiares:autorizar')
    expect(screen.queryByText('Pantalla protegida')).not.toBeInTheDocument()
    r2.unmount()
  })
})
