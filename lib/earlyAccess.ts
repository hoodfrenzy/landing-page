/**
 * The CTA lives in the nav and in the hero, while the overlay is mounted once
 * at the page root. Rather than lifting state into a provider (which would
 * force the whole page to become a client component), the triggers broadcast
 * on window and the overlay listens.
 */
export const EARLY_ACCESS_OPEN = "earlyaccess:open";
export const EARLY_ACCESS_STATE = "earlyaccess:state";

export function openEarlyAccess() {
  window.dispatchEvent(new Event(EARLY_ACCESS_OPEN));
}

/** Overlay -> hero sphere, so the sphere can dolly toward the camera. */
export function broadcastEarlyAccessState(open: boolean) {
  window.dispatchEvent(
    new CustomEvent<boolean>(EARLY_ACCESS_STATE, { detail: open }),
  );
}
