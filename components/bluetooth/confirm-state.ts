import { createState } from "ags"

/**
 * The one open unpair-confirm, for the whole module.
 *
 * A single slot, not one flag per row: "exactly one confirm open at a time" is
 * then structural rather than enforced by each row politely closing its
 * neighbours. Both mounted surfaces (bar popup and settings subview) share this
 * state because they share this module, so a confirm opened in one is closed by
 * opening one in the other.
 */
const [confirmingAddress, setConfirmingAddress] = createState<string | null>(null)

export { confirmingAddress }

export function openUnpairConfirm(address: string): void {
  setConfirmingAddress(address)
}

export function closeUnpairConfirm(): void {
  setConfirmingAddress(null)
}

/**
 * Close any open unpair confirm.
 *
 * Exported for the dismissal paths that live outside the device body — the
 * popup's catcher (`BluetoothPopup.tsx`) and `app.tsx`'s `popup-close` handler —
 * which should dismiss a confirm BEFORE the surface closes rather than after.
 */
export function dismissUnpairConfirm(): void {
  setConfirmingAddress(null)
}
