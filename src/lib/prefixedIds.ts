function getCrypto(): Crypto {
  if (typeof globalThis.crypto === 'undefined') {
    throw new Error('Crypto API is required to generate ids')
  }

  return globalThis.crypto
}

export function createPrefixedId(prefix: 'org' | 'prj'): string {
  // These ids are persisted into Postgres UUID columns, so optimistic client
  // ids must also be valid UUIDs to keep the later server push from failing.
  const crypto = getCrypto()
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback RFC-4122 v4 UUID generation when randomUUID is unavailable.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const byte6 = bytes[6]
  const byte8 = bytes[8]
  if (byte6 === undefined || byte8 === undefined) {
    throw new Error('Failed to generate UUID bytes')
  }
  bytes[6] = (byte6 & 0x0f) | 0x40
  bytes[8] = (byte8 & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
