import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env.js';

/**
 * Production-quality PHI encryption helper using AES-256-GCM.
 * 
 * ⚠️ DELIBERATELY UNUSED in the sample app routes to demonstrate
 * HIPAA §164.312(a)(2)(iv) violation. This is the "right answer"
 * that BobGuard's Compliance Officer mode will propose as a fix.
 * 
 * In production:
 * - Use a proper KMS (AWS KMS, Azure Key Vault, Google Cloud KMS)
 * - Implement key rotation
 * - Store encrypted data with version metadata
 * - Never log decrypted PHI
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Get encryption key from environment.
 * In production, retrieve from KMS instead.
 */
function getEncryptionKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt PHI field at rest using AES-256-GCM.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encryptAtRest(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
}

/**
 * Decrypt PHI field from rest using AES-256-GCM.
 * Expects format: iv:authTag:ciphertext (base64)
 */
export function decryptAtRest(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const [ivB64, authTagB64, ciphertext] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Encrypt multiple PHI fields in a record.
 * Returns object with encrypted values and metadata.
 */
export function encryptPHIFields<T extends Record<string, unknown>>(
  data: T,
  phiFields: (keyof T)[]
): T & { encryptedFields: { fields: string[]; version: string } } {
  const encrypted = { ...data, encryptedFields: { fields: [], version: '1.0.0' } } as T & {
    encryptedFields: { fields: string[]; version: string }
  };

  for (const field of phiFields) {
    const value = data[field];
    if (typeof value === 'string') {
      (encrypted as any)[field] = encryptAtRest(value);
    }
  }

  encrypted.encryptedFields = {
    fields: phiFields.map(String),
    version: '1.0.0',
  };

  return encrypted;
}

/**
 * Decrypt multiple PHI fields in a record.
 */
export function decryptPHIFields<T extends Record<string, unknown>>(
  data: T & { encryptedFields?: { fields: string[] } }
): T {
  if (!data.encryptedFields?.fields) {
    return data;
  }

  const decrypted = { ...data };

  for (const field of data.encryptedFields.fields) {
    const value = decrypted[field as keyof T];
    if (typeof value === 'string') {
      decrypted[field as keyof T] = decryptAtRest(value) as T[keyof T];
    }
  }

  return decrypted;
}

// Made with Bob
