/*
 * CamposCuenta.tsx — Bloques de formulario compartidos por los registros de Organización y de Familia:
 * provincia + municipio, datos de la persona titular y contraseña con requisitos y aceptación legal.
 * Módulo: auth (SRS §8.2.2.3.5 b: política de contraseñas · Ley 172-13: consentimiento).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useMemo } from 'react'
import { PasswordField, SelectField, TextField } from '@/components/ui'
import { useDB } from '@/domain/store'
import { CasillaLegal, RequisitosPassword } from './Piezas'
import { formatCedula, formatTelefono } from '../lib/validar'

type Errores = Record<string, string | undefined>

/** Provincia → municipio (el municipio se habilita al elegir la provincia). */
export function SelectoresUbicacion({
  provinciaCod,
  municipioCod,
  errores,
  onProvincia,
  onMunicipio,
}: {
  provinciaCod: string
  municipioCod: string
  errores: Errores
  onProvincia: (cod: string) => void
  onMunicipio: (cod: string) => void
}) {
  const catalogos = useDB((s) => s.catalogos)
  const municipios = useMemo(
    () => catalogos.municipios.filter((m) => m.provinciaCod === provinciaCod).map((m) => ({ value: m.cod, label: m.nombre })),
    [catalogos, provinciaCod],
  )
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <SelectField
        label="Provincia"
        placeholder="Seleccionar"
        options={catalogos.provincias.map((p) => ({ value: p.cod, label: p.nombre }))}
        value={provinciaCod}
        error={errores.provinciaCod}
        onChange={(e) => onProvincia(e.target.value)}
      />
      <SelectField
        label="Municipio"
        placeholder={provinciaCod ? 'Seleccionar' : 'Elige primero la provincia'}
        options={municipios}
        value={municipioCod}
        disabled={!provinciaCod}
        error={errores.municipioCod}
        onChange={(e) => onMunicipio(e.target.value)}
      />
    </div>
  )
}

export interface ValoresTitular {
  cedula: string
  nombre: string
  apellido: string
  telefono: string
  email: string
}

/** Cédula, nombre, apellido, teléfono y correo de la persona titular (5 campos de texto: el máximo por pantalla). */
export function CamposTitular({ valores, errores, onCambio }: { valores: ValoresTitular; errores: Errores; onCambio: (campo: keyof ValoresTitular, valor: string) => void }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <TextField
          label="Cédula"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000-0000000-0"
          maxLength={13}
          value={valores.cedula}
          error={errores.cedula}
          onChange={(e) => onCambio('cedula', formatCedula(e.target.value))}
        />
      </div>
      <TextField label="Nombre" autoComplete="given-name" value={valores.nombre} error={errores.nombre} onChange={(e) => onCambio('nombre', e.target.value)} />
      <TextField label="Apellido" autoComplete="family-name" value={valores.apellido} error={errores.apellido} onChange={(e) => onCambio('apellido', e.target.value)} />
      <TextField
        label="Teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="000 000 0000"
        maxLength={12}
        value={valores.telefono}
        error={errores.telefono}
        onChange={(e) => onCambio('telefono', formatTelefono(e.target.value))}
      />
      <TextField
        label="Correo electrónico"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="ejemplo@correo.com"
        value={valores.email}
        error={errores.email}
        hint="Lo usarás para iniciar sesión."
        onChange={(e) => onCambio('email', e.target.value)}
      />
    </div>
  )
}

/** Contraseña + confirmación + requisitos en vivo (incluye el carácter especial) + aceptación de Términos y Privacidad. */
export function CamposClave({
  password,
  confirmar,
  acepto,
  errores,
  onPassword,
  onConfirmar,
  onAcepto,
  id,
}: {
  password: string
  confirmar: string
  acepto: boolean
  errores: Errores
  onPassword: (v: string) => void
  onConfirmar: (v: string) => void
  onAcepto: (v: boolean) => void
  id?: string
}) {
  return (
    <>
      <PasswordField label="Contraseña" autoComplete="new-password" value={password} error={errores.password} onChange={(e) => onPassword(e.target.value)} />
      <PasswordField label="Confirmar contraseña" autoComplete="new-password" value={confirmar} error={errores.confirmar} onChange={(e) => onConfirmar(e.target.value)} />
      <RequisitosPassword id={id} password={password} confirmar={confirmar} />
      <CasillaLegal checked={acepto} error={errores.acepto} onChange={onAcepto} />
    </>
  )
}
