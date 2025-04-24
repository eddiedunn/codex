/**
 * Formats a shell command (string or string array) for display/logging.
 * Joins arrays with spaces and escapes as needed.
 */
export function formatCommandForDisplay(cmd: string | string[]): string {
  if (Array.isArray(cmd)) {
    // Naive shell escaping: wrap each arg in quotes if it contains spaces
    return cmd.map(arg => /\s/.test(arg) ? `"${arg}"` : arg).join(' ');
  }
  return cmd;
}
