/*
 * index.ts — Punto de entrada del kit de componentes UI de CuidaRed.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export { Button, ButtonLink } from './Button'
export { Icono, type NombreIcono } from './Icono'
export { TextField, PasswordField, SelectField, TextareaField, SearchInput, Checkbox, CheckboxGroup, Switch, ChoicePills, INPUT } from './Fields'
export {
  Badge,
  RiesgoBadge,
  RIESGO_VISUAL,
  Avatar,
  Card,
  LinkCard,
  IconTile,
  StatTile,
  Datum,
  InfoRow,
  Segmented,
  Chip,
  EmptyState,
  Spinner,
  StepBar,
  ProgresoRegistro,
  HelpTip,
  type Tone,
} from './Display'
export { Aviso, type TipoAviso } from './Aviso'
export { RequisitoContrasena, RequisitosContrasena, type RequisitoContrasenaDatos } from './RequisitosContrasena'
export { Opcion } from './Opcion'
export { TarjetaKpi, FilaLista, type TonoKpi, type VarianteKpi } from './Tarjetas'
export { EncabezadoPublico, type TonoEncabezado } from './EncabezadoPublico'
export { Sheet, SuccessOverlay, ToastProvider, useToast, type AccionToast } from './Overlay'
export { TextareaAbreviado, expandirAbreviatura, AYUDA_ABREVIATURAS } from './TextareaAbreviado'
export { useFormulario, requerido } from './useFormulario'
export type {
  Formulario,
  OpcionesFormulario,
  ErroresFormulario,
  ReglaCampo,
  ReglasFormulario,
  RespuestaEnvio,
  CamposEvento,
  CasillaProps,
  ValorProps,
  AbreviadoProps,
} from './useFormulario'
export { FormPasos, AvisoBorrador, type FormPasosProps, type PasoFormulario } from './FormPasos'
export { avisar, type ToastTone } from '@/domain/avisos'
