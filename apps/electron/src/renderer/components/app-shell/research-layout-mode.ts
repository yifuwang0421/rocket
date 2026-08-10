const CLASSIC_LAYOUT_VALUES = new Set(['0', 'false', 'classic'])

/**
 * The research workbench is the default Rocket shell after P1 acceptance.
 * Keep the classic shell available for one rollback cycle by setting
 * VITE_ROCKET_RESEARCH_LAYOUT=0 (or "false" / "classic").
 */
export function shouldUseResearchLayout(value: string | undefined): boolean {
  if (value === undefined || value.trim() === '') return true
  return !CLASSIC_LAYOUT_VALUES.has(value.trim().toLowerCase())
}
