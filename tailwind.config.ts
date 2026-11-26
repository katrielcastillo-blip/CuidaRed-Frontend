/*
 * tailwind.config.ts — Configuración de Tailwind CSS de CuidaRed (SRS §18.1: paleta institucional,
 * tipografía y breakpoints definidos en el archivo de configuración de Tailwind).
 * Módulo: estilos globales.
 * © 2026 Equipo CuidaRed – INTEC. Todos los derechos reservados.
 *
 * Los valores replican los design tokens de src/styles/tokens.css (variables CSS que aún usan algunos
 * estilos en línea). Si cambias un color aquí, cámbialo también allí.
 */
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Breakpoints del proyecto: móvil < 768 · tablet ≥ 768 · escritorio ≥ 1100
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1100px',
      xl: '1400px',
    },
    extend: {
      colors: {
        // Marca
        navy: { DEFAULT: '#0c3b6e', 700: '#0a3160' },
        primary: '#003f9e',
        blue: { DEFAULT: '#378add', bright: '#3b8de0', 100: '#e6f1fb' },
        teal: { DEFAULT: '#14a085', 100: '#e1f5ee' },
        green: { DEFAULT: '#1d9e75' },
        // Superficies y texto
        bg: '#f7f9fc',
        surface: { DEFAULT: '#ffffff', 2: '#e2e8f0' },
        line: { DEFAULT: '#64748b', soft: '#e2e8f0' },
        ink: { DEFAULT: '#1a2b3c', 2: '#64748b' },
        muted: '#64748b',
        // Semánticos (verde = normal · amarillo = advertencia · rojo = crítico), contraste WCAG AA
        danger: { DEFAULT: '#c0392b', 100: '#faece7' },
        warning: { DEFAULT: '#d4880a', 700: '#8a5600', 100: '#faeeda' },
        success: { DEFAULT: '#14a085', 700: '#0b6b58', 100: '#e1f5ee' },
        info: { DEFAULT: '#378add', 100: '#e6f1fb' },
        // Nivel de riesgo
        riesgo: { alto: '#c0392b', medio: '#d4880a', bajo: '#1d9e75' },
      },
      fontFamily: {
        sans: ['"Open Sans Variable"', '"Open Sans"', 'system-ui', 'sans-serif'],
        display: ['"Montserrat Variable"', 'Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: { xs: ['0.875rem', { lineHeight: '1.25rem' }] },
      borderRadius: {
        sm: '12px',
        md: '12px',
        lg: '24px',
        card: '16px',
        pill: '999px',
      },
      boxShadow: {
        1: '0 1px 2px rgba(12,59,110,.06)',
        2: '0 8px 24px rgba(12,59,110,.10)',
      },
      backgroundImage: {
        'grad-auth': 'linear-gradient(180deg, #1f6fd0 0%, #14a085 100%)',
        'grad-splash': 'linear-gradient(180deg, #e6f1fb 0%, #3b8de0 100%)',
        'grad-success': 'linear-gradient(180deg, #e6f1fb 0%, #3b8de0 100%)',
      },
      spacing: {
        gutter: 'var(--gutter)',
        appbar: 'var(--appbar-h)',
        bottomnav: 'var(--bottomnav-h)',
        sidebar: 'var(--sidebar-w)',
        // Objetivo táctil mínimo (RF-06 · WCAG 2.5.5): 48×48 px
        tap: '48px',
      },
      maxWidth: {
        content: 'var(--content-max)',
        form: '680px',
        auth: '460px',
      },
      minHeight: { tap: '48px' },
      minWidth: { tap: '48px' },
    },
  },
} satisfies Config
