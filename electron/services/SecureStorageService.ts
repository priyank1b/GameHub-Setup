import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ISecureStorageService {
  isAvailable(): boolean;
  setSecret(key: string, secret: string): void;
  getSecret(key: string): string | null;
  deleteSecret(key: string): boolean;
  hasSecret(key: string): boolean;
}

export class SecureStorageService implements ISecureStorageService {
  private static instance: SecureStorageService | null = null;
  private storageFilePath: string;
  private cache: Record<string, string> = {}; // key -> base64 encrypted string

  private constructor() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const secureDir = path.join(appData, 'GameHub', 'secure');
    if (!fs.existsSync(secureDir)) {
      fs.mkdirSync(secureDir, { recursive: true });
    }
    this.storageFilePath = path.join(secureDir, 'vault.dat');
    this.loadVault();
  }

  public static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  public isAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  private loadVault(): void {
    if (!fs.existsSync(this.storageFilePath)) {
      this.cache = {};
      return;
    }
    try {
      const data = fs.readFileSync(this.storageFilePath, 'utf8');
      this.cache = JSON.parse(data) || {};
    } catch (err: any) {
      console.warn('[SecureStorage] Unable to parse encrypted vault file. Initializing fresh cache.');
      this.cache = {};
    }
  }

  private saveVault(): void {
    try {
      fs.writeFileSync(this.storageFilePath, JSON.stringify(this.cache, null, 2), {
        encoding: 'utf8',
        mode: 0o600, // Restricted file permissions
      });
    } catch (err: any) {
      console.error('[SecureStorage] Error persisting encrypted vault:', err.message);
    }
  }

  public setSecret(key: string, secret: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid secret key');
    }
    if (!this.isAvailable()) {
      // Fallback: If safeStorage is not supported by current OS environment, encode buffer with warning
      console.warn('[SecureStorage] safeStorage is not available on this platform. Using obfuscated storage.');
      this.cache[key] = Buffer.from(secret, 'utf8').toString('base64');
      this.saveVault();
      return;
    }

    try {
      const encryptedBuffer = safeStorage.encryptString(secret);
      this.cache[key] = encryptedBuffer.toString('base64');
      this.saveVault();
    } catch (err: any) {
      console.error('[SecureStorage] Encryption failed:', err.message);
      throw new Error('Encryption failed');
    }
  }

  public getSecret(key: string): string | null {
    if (!this.cache[key]) {
      return null;
    }

    const encoded = this.cache[key];
    if (!this.isAvailable()) {
      try {
        return Buffer.from(encoded, 'base64').toString('utf8');
      } catch {
        return null;
      }
    }

    try {
      const encryptedBuffer = Buffer.from(encoded, 'base64');
      return safeStorage.decryptString(encryptedBuffer);
    } catch (err: any) {
      console.error('[SecureStorage] Decryption failed for key:', key);
      return null;
    }
  }

  public deleteSecret(key: string): boolean {
    if (key in this.cache) {
      delete this.cache[key];
      this.saveVault();
      return true;
    }
    return false;
  }

  public hasSecret(key: string): boolean {
    return Boolean(this.cache[key]);
  }
}
