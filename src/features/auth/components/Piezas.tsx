/*
 * Piezas.tsx — Piezas compartidas por los formularios públicos y de cuenta: avisos, acciones, casilla de
 * aceptación de términos y lista en vivo de requisitos de contraseña.
 * Módulo: auth (SRS §8.2.2.3.5 b: política de contraseñas robustas · Ley 172-13: consentimiento).
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Aviso as AvisoKit, ButtonLink, Checkbox, RequisitosContrasena, type RequisitoContrasenaDatos, type TipoAviso } from '@/components/ui'
import { REGLAS_PASSWORD } from '@/domain/seguridad'

/* ───────────── Avisos ───────────── */
type TonoAviso = 'error' | 'info' | 'warning' | 'offline' | 'exito'

const TIPO_AVISO: Record<TonoAviso, TipoAviso> = { error: 'error', info: 'info', warning: 'advertencia', offline: 'advertencia', exito: 'exito' }

/** Recuadro de aviso con icono (error, información, éxito, advertencia o sin conexión). Usa el `Aviso` del kit (Figma). */
export function Aviso({ tono = 'info', icono, children, className }: { tono?: TonoAviso; icono?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <AvisoKit tipo={TIPO_AVISO[tono]} icono={icono ?? (tono === 'offline' ? 'wifi_off' : undefined)} className={className}>
      {children}
    </AvisoKit>
  )
}

/** Botones al pie del formulario (abajo del todo en móvil, como en el Figma). */
export function Acciones({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3.5 pt-6 [&>a]:text-[clamp(16px,4.67vw,20px)] [&>button]:text-[clamp(16px,4.67vw,20px)]">{children}</div>
}

/** Párrafo introductorio centrado. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-pretty text-center leading-normal text-ink-2">{children}</p>
}

/** Enlace de texto subrayado con área táctil de 48 px. */
export const ENLACE = 'inline-flex min-h-12 items-center font-semibold text-[#002a70] underline underline-offset-[3px] hover:text-navy'

/** Título de cada paso de un formulario público (Figma: 20/28 semibold). Recibe el foco al cambiar de paso si se le pasa `ref`. */
export const TITULO_PASO = 'text-seccion font-semibold text-ink outline-none'

/** "¿Ya tienes una cuenta? Iniciar sesión" (Figma: pregunta gris y enlace de texto debajo). */
export function YaTienesCuenta() {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-cuerpo text-muted">¿Ya tienes una cuenta?</p>
      <ButtonLink to="/inicio" variant="ghost">
        Iniciar sesión
      </ButtonLink>
    </div>
  )
}

/** Casilla obligatoria de aceptación de Términos y Política de Privacidad (consentimiento informado). */
export function CasillaLegal({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Checkbox
        checked={checked}
        aria-invalid={!!error || undefined}
        onChange={(e) => onChange(e.target.checked)}
        className="leading-snug"
        label={
          <>
            He leído y acepto los <Link to="/terminos">Términos y Condiciones</Link> y la <Link to="/privacidad">Política de Privacidad</Link> de CuidaRed.
          </>
        }
      />
      {error && <Aviso tono="error">{error}</Aviso>}
    </div>
  )
}

/**
 * Requisitos de la contraseña con en vivo (círculo gris pendiente, check verde cumplido) (política de contraseñas robustas). Incluye, si se pasa
 * `confirmar`, la comprobación de que ambas contraseñas coinciden.
 */
export function RequisitosPassword({ password, confirmar, id }: { password: string; confirmar?: string; id?: string }) {
  const reglas: RequisitoContrasenaDatos[] = REGLAS_PASSWORD.map((r) => ({ id: r.id, texto: r.texto, cumplido: r.ok(password) }))
  if (confirmar !== undefined) reglas.push({ id: 'coinciden', texto: 'Ambas contraseñas coinciden', cumplido: !!confirmar && confirmar === password })
  return <RequisitosContrasena id={id} requisitos={reglas} />
}
