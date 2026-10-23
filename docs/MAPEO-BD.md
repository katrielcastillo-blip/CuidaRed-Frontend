# Mapeo base de datos ↔ frontend: CuidaRed

© 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.

Fuente: **«2026.09.25 Normalización BD CuidaRed», modelo final V3.0** (Grupo 5). El frontend guarda y muestra **todas las tablas y columnas** de ese modelo. Los tipos están en `src/domain/types.ts`: cada interfaz indica su tabla con `@tabla` y las columnas que cambian de nombre con `@col`. Los catálogos iniciales están en `src/domain/datosMaestros.ts`.

Convenciones del frontend: los nombres van en `camelCase`; las tablas y columnas de la BD, en `snake_case` según el SRS §18.2 (aquí se citan tal como aparecen en el diagrama). Las fechas con hora se guardan en ISO 8601 UTC.

## 1. Tablas de datos

| Tabla BD | Tipo / colección en el front | Columnas → campos | Dónde se ve y se edita |
|---|---|---|---|
| **Cuenta** | `Organizacion` · `db.orgs` | Cuenta_Id→id · Cuenta_Nombre→nombre · Cuenta_Tipo_Id→tipoCuentaId · Categoria_cuenta_Id→categoriaCuentaId · Municipio_Cod→municipioCod · Direccion · Telefono · Suscripcion_Estado→suscripcionEstado · Correo · Fecha_Creacion→creadoEn · Prueba_gratuita · Fecha_Inicio_Prueba · Fecha_Fin_Prueba · Plan_Id · Plan_Precio (desnormalizado) · User_Titular→usuarioTitularId | Admin → Configuración (datos de la cuenta) · Admin → Plan y suscripción · Registro de organización |
| **Configuracion_Cuenta** | `ConfiguracionCuenta` · `db.configuracion` | Cuenta_Id→orgId · Param_Id→parametroId · Valor · Fecha_Actualizacion→actualizadoEn | Admin → Configuración (parámetros) |
| **Plan** | `Plan` · `catalogos.planes` | todas las columnas, incluidos Limite_Envejecientes y Limite_Usuarios | Admin → Plan y suscripción · Catálogos |
| **Pago** | `Pago` · `db.pagos` | Pago_Id · Plan_Id · User_Id→usuarioId · Pago_Monto→monto · Metodo_pago_Id · Pago_Estado→estado · Pago_Fecha→fecha | Admin → Plan y suscripción (historial, registrar, confirmar o anular) |
| **Usuario** | `Usuario` · `db.usuarios` | User_Id · User_Cedula · User_Nombres→nombre · User_Apellidos→apellido · User_Correo→email · User_Contraseña→passwordHash + passwordSalt · User_Telefono · User_Estado · User_FechaRegistro→creadoEn | Admin → Usuarios · Mi perfil |
| **Membresia** | `Membresia` · `db.membresias` | User_Id · Cuenta_Id→orgId · Rol_Id→rol · Estado · Fecha_Inicio · Fecha_Fin | Admin → perfil del usuario (historial de membresías). `Usuario.rol` y `Usuario.orgId` copian la membresía vigente |
| **Cuidador** | `Cuidador` · `db.cuidadores` | Cuidador_Id · User_Id · Fecha_Inicio · Fecha_Fin · Tipo_cuidado_Id · Cuidador_Indep→independiente · user_empleador→empleadorUsuarioId | Admin → perfil del usuario (perfil de cuidador) · Agenda |
| **Notificacion** | `Notificacion` · `db.notificaciones` | Notificacion_Id · User_Id · Notificacion_fecha→fecha · Notificacion_mensaje→mensaje · Plan_Id · Cuenta_Id→orgId · Estado · Fecha_lectura | Campana de la barra superior (todos los roles) |
| **Envejeciente** | `Adulto` · `db.adultos` | Env_Id · Env_Nombres→nombre · Env_Apellidos→apellido · Env_Cedula · Env_FechaNacimiento · Municipio_Cod · Env_Direccion→zona + direccion · Env_Telefono · Env_Sexo · Env_Estado · Env_FechaCreacion→creadoEn · User_registrador→registradoPor · Cuenta_Id→orgId | Adultos → nuevo / editar / perfil |
| **Contacto_emergencia** | `ContactoEmergencia` · `db.contactos` | Contacto_Id · Env_Id · nombres · apellidos · Parentesco · telefono · Es_Principal | Perfil del adulto → Contactos (el principal también en el formulario) |
| **Vinculo** | `Vinculo` · `db.vinculos` | Env_Id→adultoId · User_Id→usuarioId · Tipo_vinculo_Id | Perfil del adulto → voluntarios asignados y familiares responsables · Admin → usuario familiar. **Define el control de acceso** del voluntario y del familiar |
| **Env_Riesgo** | `EnvRiesgo` · `db.riesgos` | Env_Id · Riesgo_Id · Riesgo_Fecha · Nivel_Riesgo_Id→nivel · Riesgo_Estado · Riesgo_Motivo · Riesgo_Observacion | Perfil del adulto → historial de riesgos (nuevo factor, superar). `Adulto.riesgo` es el nivel vigente más alto |
| **Indicacion_Medica** | `IndicacionMedica` · `db.indicaciones` | Indicacion_Id · Env_Id · Tipo_Indicacion_Id · Titulo · Descripcion · Frecuencia_horario · Fecha_Inicio · Fecha_Fin · Estado · Evidencia | Perfil del adulto → Indicaciones (permiso `indicaciones:*`; el familiar no las ve) |
| **Visita** + **RegistroVisita** + **DetalleVisita** | `Visita` · `db.visitas` | Visit_Id · Visit_Estado · Visit_razon→razon · Visit_Fecha · Visit_HoraInicio→inicio · Visit_HoraFin→fin · RegistroVisita.User_Id→cuidadorId · Autorizada_por_user_Id→autorizadaPor · DetalleVisita (Env_Id, Observacion)→adultoId/observaciones (principal) + detallesAdicionales[] | Registrar / programar / detalle de visita |
| **Env_Necesidad** | `Necesidad` · `db.necesidades` | Necesidad_Id→catalogoId · Env_Id · Necesidad_Fecha→creadaEn · Cantidad · Unidad_Medida→unidad · Necesidad_Estado→estado · es_recurrente→recurrente · Prioridad_Id→prioridad · Fecha_resolucion→satisfechaEn · motivo_resolucion · User_responsable→responsableId · Indicacion_Id · Umbral_alerta→umbralAlertaDias | Registrar / detalle de necesidad |
| **AlertaEnvejeciente** | `Alerta` · `db.alertas` | Env_Id · Alert_Id→tipo · Descripcion · Alert_Fecha→creadaEn · Prioridad_Id→severidad · Estado · Fecha_Atencion→atendidaEn · Accion_tomada→notaAtencion (+ acciones[]) · Atentida_por_user_Id→atendidaPor | Alertas (lista, detalle y gestión) |
| **Tarea_agenda** | `Tarea` · `db.tareas` | Tarea_Id · Cuidador_Id · Indicacion_Id · Env_Id · Titulo_Tarea→titulo · Hora_programada · Prioridad_Id · Estado · Requiere_evidencia · tarea_repetitiva→repetitiva · Fecha_programada · User_creador→creadaPor | Agenda (coordinador: crear y asignar; voluntario/cuidador: ejecutar) |
| **Evidencias** | `Evidencia` · `db.evidencias` | Evidencia_Id · Tarea_Id · Fecha_registro · Archivo_url→archivo · Observacion · Estado_validacion | Agenda → detalle de tarea (subir y validar) |

## 2. Catálogos (`db.catalogos`, datos maestros)

| Tabla BD | Colección | Uso |
|---|---|---|
| Rol | `roles` | Los 4 roles del SRS |
| TipoCuenta · Categoria_cuenta | `tiposCuenta` · `categoriasCuenta` | Datos de la cuenta |
| PlanCategoria · Plan | `categoriasPlan` · `planes` | Suscripción |
| MetodoPago | `metodosPago` | Pagos |
| Provincia · Municipio | `provincias` · `municipios` | Ubicación de la cuenta y de los adultos |
| TipoNecesidad · Necesidad | `tiposNecesidad` · `necesidades` | Formulario de necesidad |
| Alertas · Prioridad | `alertas` · `prioridades` | Tipos de alerta y prioridad (alertas, necesidades, tareas) |
| Riesgo · Nivel_Riesgo | `riesgos` · `nivelesRiesgo` | Factores de riesgo y niveles |
| Tipo_Indicacion · Tipo_vinculo · Tipo_Cuidado | `tiposIndicacion` · `tiposVinculo` · `tiposCuidado` | Indicaciones, vínculos y cuidadores |
| Parametros | `parametros` | Valores por defecto de la configuración |

El administrador puede consultar todos los catálogos en **Admin → Más → Catálogos**.

## 3. Datos que exige el SRS y la BD V3.0 no tiene (recomendación para el backend)

| Dato en el front | Requisito SRS | Propuesta para la BD |
|---|---|---|
| `RegistroAuditoria` (`db.auditoria`) | §8.2.2.1.3, §8.2.2.3.4 e, §8.2.2.3.5 j | Tabla `auditoria (id, fecha_utc, user_id, rol, cuenta_id, accion, entidad, registro_id, resultado, detalle)`, de solo inserción |
| `actualizadoEn` / `actualizadoPor` en Envejeciente, Visita, Env_Necesidad, AlertaEnvejeciente, Indicacion_Medica, Tarea_agenda | RF-10 / CU-14 (Last-Write-Wins con marca UTC) | Columnas `updated_at timestamptz` y `updated_by` |
| `Adulto.consentimiento` | Ley 172-13 (§8.2.2.3.3, §17.3) | Columnas `consentimiento_otorgado`, `consentimiento_por`, `consentimiento_fecha` en Envejeciente |
| `Adulto.condicionGeneral` (autonomía + condiciones) | RF-01 «condición general» | Tabla `env_condicion` o columnas en Envejeciente |
| `Visita.checklist`, `estadoAdulto`, `evidencias` | CU-05 «checklist de aspectos verificados» | Tabla `visita_aspecto (visit_id, aspecto)` y columna `estado_adulto` |
| `Necesidad.historial` | CU-08 / auditoría | Tabla `necesidad_historial (necesidad_id, estado, fecha, user_id, nota)` |
| `Alerta.acciones`, `condiciones`, `leidaPor` | CU-09 paso 4 (registrar acciones tomadas) | Tabla `alerta_accion` (la BD solo guarda la última Accion_tomada) |
| `Invitacion`, `Recuperacion`, `BloqueoLogin` | §8.2.2.3.5 b | Los gestiona Supabase Auth (invitaciones, recuperación, límites de intentos) |

## 4. Observaciones sobre el diseño de la BD V3.0

1. **Claves primarias compuestas que impiden el historial.** `Env_Necesidad (Necesidad_Id, Env_Id)` no permite registrar dos veces la misma necesidad del catálogo para el mismo adulto (por ejemplo, la reposición mensual de un medicamento). `AlertaEnvejeciente (Env_Id, Alert_Id)` no permite dos alertas del mismo tipo (RF-05 se repite cada vez que se superan los 15 días). `Env_Riesgo (Env_Id, Riesgo_Id)` no permite reevaluar un mismo factor. **Recomendación:** una clave sustituta (`id`) y mantener las FK. El front ya usa ese `id` propio.
2. **`User_Contraseña` en Usuario.** El SRS §8.2.2.3.5 b exige Supabase Auth: la tabla no debe guardar la contraseña ni su hash. Basta con una FK a `auth.users`. En el front se simula con hash PBKDF2 y sal.
3. **Nombres.** El SRS §18.2 pide `snake_case` para tablas y columnas. El diagrama mezcla `PascalCase` y `snake_case`, y tiene erratas: `Atentida_por_user_Id`, `RIesgo_Fecha`, `Neccesidad`.
4. **`Plan_Precio` y `User_Titular` desnormalizados** en Cuenta, y `User_Id` en Pago: el front los respeta (`planPrecio` se copia al cambiar de plan).
5. **Familias.** La BD no tiene grupos familiares: el acceso del familiar responsable se modela con `Vinculo` de tipo «familiar_responsable», igual que en el front.
6. **Monetización.** Plan, Pago y MetodoPago quedan fuera del MVP según el SRS §8.1. El front solo permite registrarlos y consultarlos, sin cobros.
