interface RocketSymbolProps {
  className?: string
}

/**
 * Rocket app mark. Colors intentionally use currentColor so the symbol follows
 * the active theme and remains legible in menus, onboarding, and splash views.
 */
export function RocketSymbol({ className }: RocketSymbolProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M128 24c-29 24-45 60-45 101v31l-23 23v27l42-13h52l42 13v-27l-23-23v-31c0-41-16-77-45-101Z"
        fill="currentColor"
      />
      <circle cx="128" cy="103" r="20" fill="var(--background)" opacity="0.9" />
      <path
        d="M108 193c2 20 9 34 20 43 11-9 18-23 20-43h-40Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  )
}
