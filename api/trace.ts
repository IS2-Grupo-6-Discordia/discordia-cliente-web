// Ids for distributed tracing (documentacion/observabilidad.md). The client
// doesn't load the OpenTelemetry SDK: it only generates a traceparent and a
// request id per request, so the trace is born here and every service joins it.

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes)
  // Not every React Native runtime has `crypto`, and these ids aren't secrets.
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else values.forEach((_, i) => (values[i] = Math.floor(Math.random() * 256)))
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("")
}

// W3C Trace Context, always sampled (flags 01).
export function newTraceparent(): string {
  return `00-${randomHex(16)}-${randomHex(8)}-01`
}

// UUID v4: the same shape the services generate when they don't receive one.
export function newRequestId(): string {
  const hex = randomHex(16)
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`
}

export function newTraceHeaders(): { traceparent: string; "X-Request-Id": string } {
  return { traceparent: newTraceparent(), "X-Request-Id": newRequestId() }
}
