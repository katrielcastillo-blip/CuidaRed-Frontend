# CuidaRed: frontend (PWA)

Prototipo funcional de **CuidaRed · Seguimiento Comunitario**, implementado desde las secciones «Prototipo Funcional» del Figma.
Es una PWA instalable y responsive: en el teléfono se ve como el diseño móvil (header navy y bottom-nav), en tablet con una barra lateral de iconos y en escritorio con una barra lateral completa y rejillas.

## Arrancar
```bash
npm install
npm run dev          # http://localhost:5173 (también accesible desde el teléfono en la misma red: http://<IP-del-PC>:5173)
npm run build        # build de producción + service worker (dist/)
npm run preview      # sirve dist/ (para probar la instalación como app)
```

## Cuentas demo (contraseña `Demo1234`)
| Rol | Correo |
|---|---|
| Cuidador (voluntario) | cuidador@cuidared.do |
| Familiar | familiar@cuidared.do |
| Administrador | admin@cuidared.do |
| Coordinador | coordinador@cuidared.do |

En el login, «Cuentas de demostración» rellena el formulario. Los datos viven en `localStorage`. Para volver al estado inicial: Mi Perfil → «Restablecer datos de demostración».

## Estructura
- `src/domain/`: modelo, datos semilla, store local y sesión.
- `src/components/ui/`: kit de componentes. `src/layouts/AppShell.tsx` es el esqueleto responsive y `<Page>`.
- `src/features/<área>/`: pantallas por rol (`auth`, `cuidador`, `familiar`, `admin`, `coordinador`) y módulos compartidos (`perfil`, `visitas`, `gestion`).
- `docs/AGENTES.md`: convenciones del proyecto. `docs/figma/`: referencia del Figma.

## Verificación
```bash
node scripts/smoke.mjs                         # todas las rutas × 5 roles × 360/768/1280 px
node scripts/smoke.mjs --escenario huerfanos   # referencias a miembros eliminados
node scripts/shot.mjs admin/reportes admin rep # capturas móvil + escritorio en shots/
```
(requiere el servidor de desarrollo corriendo)
