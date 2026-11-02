/**
 * Navigation from outside a component.
 *
 * Menus, shortcuts and the command palette are built as plain data, not as
 * components, so they cannot call `useNavigate`. The shell registers the
 * router's navigate function here once, and everything else goes through it.
 */

type NavigateFn = (to: string | number, options?: { replace?: boolean }) => void;

let navigateImpl: NavigateFn | null = null;
const pending: Array<[string | number, { replace?: boolean } | undefined]> = [];

export function registerNavigate(fn: NavigateFn | null): void {
  navigateImpl = fn;
  if (fn) {
    for (const [to, options] of pending.splice(0)) fn(to, options);
  }
}

export function navigate(to: string | number, options?: { replace?: boolean }): void {
  if (navigateImpl) navigateImpl(to, options);
  else pending.push([to, options]);
}
