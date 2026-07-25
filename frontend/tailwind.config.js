/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Navy-purple base (neumorphic dark theme)
        navy: {
          950: '#15162B',  // bg-primary-dark (darkest)
          900: '#1A1B2E',  // bg-primary (page background)
          800: '#22243D',  // bg-secondary (cards)
          700: '#262A47',  // bg-tertiary (elevated cards)
          600: '#2A2D4A',  // bg-hover
        },
        
        // Teal-blue gradient colors
        teal: {
          400: '#2DD4BF',  // Gradient start
          500: '#1fb4a0',  // Darker teal (hover state)
        },
        
        // Lavender-gray text (warmer than default slate)
        lavender: {
          300: '#B4BAD9',  // Lighter
          400: '#9CA3C4',  // text-secondary
          500: '#6B7094',  // text-muted
          600: '#5A5F82',  // Darker
        },
        
        // Category colors with light variants for gradients
        category: {
          work: { base: '#3B82F6', light: '#60A5FA' },
          finance: { base: '#10B981', light: '#34D399' },
          newsletter: { base: '#A855F7', light: '#C084FC' },
          promotional: { base: '#F97316', light: '#FB923C' },
          personal: { base: '#06B6D4', light: '#22D3EE' },
          spam: { base: '#EF4444', light: '#F87171' },
        },
        
        // Risk level colors
        risk: {
          low: '#10B981',
          moderate: '#F59E0B',
          high: '#F97316',
          danger: '#EF4444',
        },
        
        // Avatar gradient palette
        avatar: {
          orange: { base: '#F97316', light: '#FB923C' },
          pink: { base: '#EC4899', light: '#F472B6' },
          cyan: { base: '#06B6D4', light: '#22D3EE' },
          green: { base: '#10B981', light: '#34D399' },
          purple: { base: '#A855F7', light: '#C084FC' },
          yellow: { base: '#EAB308', light: '#FACC15' },
        },
      },
      
      boxShadow: {
        // Neumorphic elevation shadows (soft, floating appearance)
        'neumorphic-sm': '0 2px 12px rgba(0, 0, 0, 0.25)',
        'neumorphic-md': '0 4px 20px rgba(0, 0, 0, 0.35)',
        'neumorphic-lg': '0 8px 32px rgba(0, 0, 0, 0.45)',
        
        // Glow effects for active states
        'glow-teal': '0 0 16px rgba(45, 212, 191, 0.3)',
        'glow-blue': '0 0 16px rgba(59, 130, 246, 0.3)',
        'glow-danger': '0 0 16px rgba(239, 68, 68, 0.3)',
        
        // Inset shadow for inputs (pressed-in look)
        'inset-input': 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
        
        // Combined shadows for focus states
        'focus-teal': '0 0 0 3px rgba(45, 212, 191, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.2)',
        
        // Hover lift effect (stronger shadow)
        'hover-lift': '0 6px 24px rgba(0, 0, 0, 0.4)',
      },
      
      borderRadius: {
        'card': '16px',    // Standard card radius
        'input': '12px',   // Input/dropdown radius
        'button': '12px',  // Button radius
      },
      
      backgroundImage: {
        // Primary gradients
        'gradient-primary': 'linear-gradient(135deg, #2DD4BF 0%, #3B82F6 100%)',
        'gradient-danger': 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)',
        'gradient-success': 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
        'gradient-warning': 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
        
        // Page background gradient
        'gradient-page': 'linear-gradient(135deg, #1A1B2E 0%, #15162B 100%)',
        
        // Category gradients
        'gradient-work': 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)',
        'gradient-finance': 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
        'gradient-newsletter': 'linear-gradient(135deg, #A855F7 0%, #C084FC 100%)',
        'gradient-promotional': 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
        'gradient-personal': 'linear-gradient(135deg, #06B6D4 0%, #22D3EE 100%)',
        'gradient-spam': 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
      },
      
      transitionDuration: {
        '200': '200ms',  // Standard transition
      },
      
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      spacing: {
        '18': '4.5rem',   // 72px
        '112': '28rem',   // 448px
      },
      
      minHeight: {
        'tap': '44px',    // Minimum tap target
      },
      
      minWidth: {
        'tap': '44px',    // Minimum tap target
      },
    },
  },
  plugins: [],
}
