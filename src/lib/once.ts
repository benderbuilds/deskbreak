/**
 * Things that should happen once per finished reset, not once per render.
 *
 * Done can be revisited: a refresh, the back button, or opening the tab again.
 * A celebration tune and a prompt-shown event are both "the first time this
 * reset landed here" moments, so they are marked in sessionStorage against the
 * session id rather than a ref that a remount resets.
 */
const PREFIX = "deskbreak.once.";

export function markOnce(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const full = `${PREFIX}${key}`;
    if (window.sessionStorage.getItem(full)) return false;
    window.sessionStorage.setItem(full, "1");
    return true;
  } catch {
    // Storage blocked: better to act each time than never. Nothing here is
    // destructive, and analytics has its own deduplication.
    return true;
  }
}
