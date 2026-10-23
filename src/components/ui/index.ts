/*
 * index.ts — Punto de entrada del kit de componentes UI de CuidaRed.
 * Módulo: kit de componentes UI.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 */
export { Button, ButtonLink } from './Button'
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
  HelpTip,
  type Tone,
} from './Display'
export { Sheet, SuccessOverlay, ToastProvider, useToast } from './Overlay'
export { TextareaAbreviado, expandirAbreviatura, AYUDA_ABREVIATURAS } from './TextareaAbreviado'
export { avisar, type ToastTone } from '@/domain/avisos'
