/*
 * Splash.tsx — "/": pantalla de bienvenida con el logosímbolo; a los ~1.2 s entra al inicio del rol o al login.
 * Módulo: auth (SRS §18.3 "Pantalla de bienvenida y carga inicial").
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOME_BY_ROL, useSession } from '@/domain/auth'

export default function Splash() {
  const { user } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate(user ? HOME_BY_ROL[user.rol] : '/inicio', { replace: true }), 1200)
    return () => clearTimeout(t)
  }, [navigate, user])

  return (
    <main className="grid min-h-dvh place-items-center bg-[linear-gradient(180deg,#e6f1fb_33.654%,#378add_100%)]" aria-label="CuidaRed" aria-busy="true">
      <img
        className="h-auto w-[clamp(120px,34vw,170px)] animate-pop motion-reduce:animate-none"
        src="/brand/logosimbolo.png"
        width={149}
        height={178}
        alt="CuidaRed"
      />
    </main>
  )
}
