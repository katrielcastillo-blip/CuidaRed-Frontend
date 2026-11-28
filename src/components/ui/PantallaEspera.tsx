/*
 * PantallaEspera.tsx — Pantalla de espera (Figma «Pantalla de espera»): degradado de azul claro a azul, logosímbolo
 * y «Cargando CuidaRed…». Se usa mientras carga la aplicación o se comprueba la sesión; no introduce retrasos.
 * El logosímbolo es el archivo local (no consulta la marca configurable) para no depender de la red al arrancar.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export function PantallaEspera({ mensaje = 'Cargando CuidaRed…' }: { mensaje?: string }) {
  return (
    <main role="status" className="flex min-h-dvh flex-col items-center justify-center gap-14 bg-grad-splash px-4 pb-[6dvh] text-center">
      <img src="/brand/logosimbolo.png" alt="" width={128} height={152} className="h-auto w-32" />
      <p className="text-tarjeta text-navy wrap-anywhere">{mensaje}</p>
    </main>
  )
}
