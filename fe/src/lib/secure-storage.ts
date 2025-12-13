import CryptoJS from 'crypto-js';

const getStorageKeyName = (userEmail: string): string => {
  if (!userEmail) {
    // Fallback for cases where user email might not be available, though it should be.
    console.warn('User email not provided for encryption key generation. Using a generic key.');
    return 'app_secret_key_generic';
  }
  return `app_secret_key_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
};

/**
 * Retrieves the user-specific encryption key from localStorage.
 * If it doesn't exist, it generates a new one, saves it, and returns it.
 */
const getEncryptionKey = (userEmail: string): string => {
  const storageKey = getStorageKeyName(userEmail);
  let secretKey = localStorage.getItem(storageKey);
  if (!secretKey) {
    secretKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    localStorage.setItem(storageKey, secretKey);
  }
  return secretKey;
};

/**
 * Encrypts data using AES.
 * @param data The string to encrypt.
 * @returns The encrypted string.
 */
export const encryptData = (data: string, userEmail: string): string => {
  const key = getEncryptionKey(userEmail);
  const encrypted = CryptoJS.AES.encrypt(data, key).toString();
  return encrypted;
};

/**
 * Decrypts data using AES.
 * @param encryptedData The encrypted string to decrypt.
 * @returns The original decrypted string.
 */
export const decryptData = (encryptedData: string, userEmail: string): string => {
  if (!encryptedData || !userEmail) return '';
  try {
    const key = getEncryptionKey(userEmail);
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
};

