import { describe, it, expect, beforeAll } from 'vitest';
import { encryptAtRest, decryptAtRest, encryptPHIFields, decryptPHIFields } from './phi-crypto.js';

describe('phi-crypto', () => {
  beforeAll(() => {
    // Set test encryption key
    process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes in hex
  });

  describe('encryptAtRest / decryptAtRest', () => {
    it('should encrypt and decrypt a string', () => {
      const plaintext = '123-45-6789';
      const encrypted = encryptAtRest(plaintext);
      
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // Format: iv:authTag:ciphertext
      
      const decrypted = decryptAtRest(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'sensitive-data';
      const encrypted1 = encryptAtRest(plaintext);
      const encrypted2 = encryptAtRest(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decryptAtRest(encrypted1)).toBe(plaintext);
      expect(decryptAtRest(encrypted2)).toBe(plaintext);
    });

    it('should throw on invalid encrypted format', () => {
      expect(() => decryptAtRest('invalid')).toThrow('Invalid encrypted format');
    });

    it('should throw on invalid auth tag', () => {
      const plaintext = 'test';
      const encrypted = encryptAtRest(plaintext);
      const parts = encrypted.split(':');
      // Replace auth tag with invalid one
      const tampered = `${parts[0]}:${'A'.repeat(24)}:${parts[2]}`;
      
      expect(() => decryptAtRest(tampered)).toThrow();
    });
  });

  describe('encryptPHIFields / decryptPHIFields', () => {
    it('should encrypt specified fields in a record', () => {
      const patient = {
        id: 'patient-123',
        name: 'John Doe',
        ssn: '123-45-6789',
        dob: '1980-01-01',
      };

      const encrypted = encryptPHIFields(patient, ['ssn', 'dob']);

      expect(encrypted.id).toBe(patient.id);
      expect(encrypted.name).toBe(patient.name);
      expect(encrypted.ssn).not.toBe(patient.ssn);
      expect(encrypted.dob).not.toBe(patient.dob);
      expect(encrypted.encryptedFields).toEqual({
        fields: ['ssn', 'dob'],
        version: '1.0.0',
      });
    });

    it('should decrypt specified fields in a record', () => {
      const patient = {
        id: 'patient-123',
        name: 'John Doe',
        ssn: '123-45-6789',
        dob: '1980-01-01',
      };

      const encrypted = encryptPHIFields(patient, ['ssn', 'dob']);
      const decrypted = decryptPHIFields(encrypted);

      expect(decrypted.ssn).toBe(patient.ssn);
      expect(decrypted.dob).toBe(patient.dob);
    });

    it('should handle records without encryptedFields metadata', () => {
      const data = { id: '123', name: 'Test' };
      const result = decryptPHIFields(data);
      expect(result).toEqual(data);
    });
  });
});

// Made with Bob
