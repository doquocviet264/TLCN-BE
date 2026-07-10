import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.CCCD_ENCRYPTION_KEY || '0'.repeat(64), 'hex');

/**
 * Encrypt a plain text string using AES-256-GCM
 * Returns: "iv:authTag:ciphertext" (all hex)
 */
export function encryptField(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a string encrypted by encryptField
 * Input format: "iv:authTag:ciphertext" (all hex)
 */
export function decryptField(cipherText) {
  if (!cipherText) return null;
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Mask an ID number to show only last 4 digits
 * Example: "012345678901" -> "****5678901"
 * Works on both plain and encrypted values (tries to detect)
 */
export function maskIdNumber(value) {
  if (!value) return null;
  // If it looks encrypted (contains colons), we can't mask without decrypting
  // Return generic masked value
  if (value.includes(':')) return '****';
  const str = String(value);
  if (str.length <= 4) return '****';
  return '*'.repeat(str.length - 4) + str.slice(-4);
}
