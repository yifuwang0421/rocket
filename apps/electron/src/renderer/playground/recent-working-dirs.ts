export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/rocket',
    '/Users/demo/projects/rocket/apps/electron',
    '/Users/demo/projects/rocket/packages/shared',
  ],
  many: [
    '/Users/demo/projects/rocket',
    '/Users/demo/projects/rocket/apps/electron',
    '/Users/demo/projects/rocket/apps/viewer',
    '/Users/demo/projects/rocket/apps/cli',
    '/Users/demo/projects/rocket/packages/shared',
    '/Users/demo/projects/rocket/packages/server-core',
    '/Users/demo/projects/rocket/packages/pi-agent-server',
    '/Users/demo/projects/rocket/packages/ui',
    '/Users/demo/projects/rocket/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
