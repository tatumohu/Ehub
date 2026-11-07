// Compute SHA-256 content hash for contract body and title
export async function computeContractHash(title: string, body: string): Promise<string> {
  const text = `${title || ''}\n${body || ''}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('Error computing SubtleCrypto hash:', e);
    }
  }

  // Fallback string hash algorithm
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  return 'fallback_' + (hash1 >>> 0).toString(16) + (hash2 >>> 0).toString(16);
}

// Synchronous string hash comparison helper
export function isContractHashDifferent(
  currentTitle: string,
  currentBody: string,
  previousHash?: string,
  previousBody?: string
): boolean {
  if (previousBody !== undefined && previousBody !== null) {
    if (previousBody !== currentBody) return true;
  }
  return false;
}
