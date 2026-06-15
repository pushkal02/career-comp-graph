/**
 * Computes the SHA-256 hash of a string natively in the browser.
 * This ensures plain-text passwords are never sent over the network.
 * @param {string} message 
 * @returns {Promise<string>} Hex representation of the SHA-256 hash
 */
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
