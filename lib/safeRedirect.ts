// Post-login redirect guard. A `redirect` query param can be crafted by anyone
// who shares a link, so it must never be trusted to point anywhere outside the
// app: an open redirect would let an attacker bounce a freshly authenticated
// user to an external page. We only ever honor the invite deep-link route, and
// fall back to the home screen for anything else.
export const HOME_ROUTE = "/(main)/chat"

export function safeRedirect(raw: unknown): string {
  if (typeof raw !== "string") return HOME_ROUTE
  const value = raw.trim()

  // Allow-list: only internal invite links, e.g. "/invite/abc123".
  // Reject protocol-relative ("//host"), absolute URLs with a scheme
  // ("http://", "javascript:"), and anything with whitespace or angle brackets.
  if (!value.startsWith("/invite/")) return HOME_ROUTE
  if (value.startsWith("//")) return HOME_ROUTE
  if (value.includes("://")) return HOME_ROUTE
  if (/[\s<>]/.test(value)) return HOME_ROUTE

  return value
}
