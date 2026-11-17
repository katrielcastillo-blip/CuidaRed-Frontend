/* Avisos Web Push de CuidaRed. © 2026 Equipo CuidaRed – INTEC. */
(() => {
  const tipoAviso = 'cuidared-alerta'
  const esCuenta = (valor) => typeof valor === 'string' && /^[1-9][0-9]{0,18}$/.test(valor)
  const esAviso = (valor) => typeof valor === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(valor)

  self.addEventListener('push', (evento) => {
    let datos
    try {
      datos = evento.data?.json()
    } catch {
      // Un aviso sin identificador abre Inicio y conserva el mismo mensaje genérico.
    }
    evento.waitUntil(self.registration.showNotification('CuidaRed', {
      body: 'Tienes una alerta nueva en CuidaRed.',
      icon: '/icons/icon-192.png',
      ...(esAviso(datos?.aviso_id) ? { tag: datos.aviso_id } : {}),
      data: { tipo: tipoAviso, cuenta_id: esCuenta(datos?.cuenta_id) ? datos.cuenta_id : null },
    }))
  })

  self.addEventListener('notificationclick', (evento) => {
    const datos = evento.notification.data
    if (datos?.tipo !== tipoAviso) return
    evento.notification.close()
    const ruta = esCuenta(datos.cuenta_id) ? `/operacion/${datos.cuenta_id}/alertas?bandeja=avisos` : '/inicio'
    const destino = new URL(ruta, self.location.origin).href
    evento.waitUntil((async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const abierta = ventanas.find((ventana) => ventana.url === destino)
      if (abierta) return abierta.focus()
      return self.clients.openWindow(destino)
    })())
  })
})()
