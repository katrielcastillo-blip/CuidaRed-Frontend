/* GuiasPublicas.tsx — Manual breve del portal conectado. Módulo auth. © 2026 Equipo CuidaRed – INTEC. */
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Circulos } from '../components/Circulos'

const enlace = 'inline-flex min-h-12 items-center gap-2 font-semibold text-navy underline underline-offset-4'

export function GuiasPublicas({ conectado = true, conSesion = false }: { conectado?: boolean; conSesion?: boolean }) {
  return <main className="min-h-dvh bg-bg text-ink">
    <header className="relative isolate overflow-clip border-b border-line-soft bg-white pt-safe">
      <Circulos variante="portada" />
      <div className="relative z-10 mx-auto max-w-4xl px-5 pt-4 pb-8 sm:px-8 sm:pb-12">
        <Link className={enlace} to={conSesion ? '/cuenta' : '/#documentacion'}><ArrowLeft size={18} aria-hidden /> {conSesion ? 'Volver a mi cuenta' : 'Volver a guías y contacto'}</Link>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-navy sm:text-5xl">Manual de usuario</h1>
        <p className="mt-2 max-w-lg leading-relaxed text-ink-2">Consulta cómo pedir una visita, gestionar la agenda y preparar el registro en campo.</p>
      </div>
    </header>
    <div className="mx-auto grid max-w-4xl gap-4 px-5 py-8 sm:px-8">
      <section className="grid gap-3 rounded-md border border-line-soft bg-white p-5 sm:p-6" aria-labelledby="guia-visitantes">
        <h2 id="guia-visitantes" className="flex items-center gap-2 text-lg font-bold text-navy"><CalendarDays size={21} aria-hidden /> Solicitudes de visita</h2>
        <ol className="list-decimal space-y-2 pl-5 text-ink-2">
          <li>Selecciona la organización y completa los datos de la persona que será el contacto responsable.</li>
          <li>Elige una visita personal para visitar a alguien concreto. Para una fundación, iglesia, universidad u otro grupo, elige la visita institucional e indica su nombre, la cantidad de visitantes y la actividad o aporte previsto.</li>
          <li>Indica un correo válido y propón la fecha, la hora de inicio y la hora de fin. La organización confirmará el horario y la disponibilidad.</li>
          <li>Guarda el código que aparece al enviar el formulario. Úsalo para ver si la organización aceptó tu solicitud o cambió el horario.</li>
          <li>Desde el inicio del horario autorizado, consulta el mismo código para compartir observaciones y hasta tres fotografías. Recibirás un correo con el enlace; la organización confirmará la realización después del horario.</li>
        </ol>
        <div className="flex flex-wrap gap-x-6">
          <Link className={enlace} to={conectado ? '/solicitar-visita' : '/#solicitar-visita'}>Solicitar una visita <ArrowRight size={17} aria-hidden /></Link>
          <Link className={enlace} to="/solicitud-visita">Consultar mi solicitud <ArrowRight size={17} aria-hidden /></Link>
        </div>
      </section>
      <section className="grid gap-3 rounded-md border border-line-soft bg-white p-5 sm:p-6" aria-labelledby="guia-equipo">
        <h2 id="guia-equipo" className="flex items-center gap-2 text-lg font-bold text-navy"><BookOpen size={21} aria-hidden /> Agenda e historial</h2>
        <p className="leading-relaxed text-ink-2">En una cuenta de organización, la coordinación y la administración revisan las solicitudes, eligen un responsable y comprueban la disponibilidad en el calendario. El historial muestra las visitas realizadas y canceladas según los permisos de cada persona.</p>
        <Link className={enlace + ' justify-self-start'} to="/inicio">Iniciar sesión <ArrowRight size={17} aria-hidden /></Link>
      </section>
      <section className="grid gap-3 rounded-md border border-line-soft bg-white p-5 sm:p-6" aria-labelledby="guia-campo">
        <h2 id="guia-campo" className="flex items-center gap-2 text-lg font-bold text-navy"><WifiOff size={21} aria-hidden /> Registro sin conexión</h2>
        <p className="leading-relaxed text-ink-2">Antes de salir, inicia sesión y abre tu visita autorizada. Puedes guardar el checklist y tus observaciones sin internet. CuidaRed enviará la captura cuando vuelvas a conectarte con tu cuenta. Para adjuntar fotos o comprobantes sí necesitas conexión.</p>
      </section>
    </div>
  </main>
}
