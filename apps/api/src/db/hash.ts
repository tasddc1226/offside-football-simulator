/** Workers `crypto.subtle`를 쓴다. domain의 순수 구현은 서버에서 쓰지 않는다(설계 결정 4). */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
