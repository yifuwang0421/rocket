/**
 * Centralized path configuration for Rocket.
 *
 * Supports multi-instance development via ROCKET_CONFIG_DIR environment variable.
 * When running from a numbered folder (e.g., craft-tui-agent-1), the detect-instance.sh
 * script sets ROCKET_CONFIG_DIR to ~/.rocket-1, allowing multiple instances to run
 * simultaneously with separate configurations.
 *
 * Default (non-numbered folders): ~/.rocket/
 * Instance 1 (-1 suffix): ~/.rocket-1/
 * Instance 2 (-2 suffix): ~/.rocket-2/
 */

import { homedir } from 'os';
import { join } from 'path';

// Allow override via environment variable for multi-instance dev
// Falls back to default ~/.rocket/ for production and non-numbered dev folders
export const CONFIG_DIR = process.env.ROCKET_CONFIG_DIR || join(homedir(), '.rocket');
