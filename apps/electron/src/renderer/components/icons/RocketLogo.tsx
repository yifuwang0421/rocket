import { RocketSymbol } from './RocketSymbol'

interface RocketLogoProps {
  className?: string
}

/** Rocket wordmark used in wide brand placements. */
export function RocketLogo({ className }: RocketLogoProps) {
  return (
    <span className={className} aria-label="Rocket">
      <span className="inline-flex h-full items-center gap-[0.35em]">
        <RocketSymbol className="h-full w-auto shrink-0" />
        <span className="font-semibold tracking-[0.12em]">ROCKET</span>
      </span>
    </span>
  )
}
