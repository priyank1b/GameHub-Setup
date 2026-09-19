import path from 'path';
import fs from 'fs';
import os from 'os';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export class Logger {
  private static logFilePath: string | null = null;
  private static isInitialized = false;

  public static getLogPath(): string {
    if (!this.logFilePath) {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      const logDir = path.join(appData, 'GameHub', 'logs');
      if (!fs.existsSync(logDir)) {
        try {
          fs.mkdirSync(logDir, { recursive: true });
        } catch (e) {}
      }
      this.logFilePath = path.join(logDir, 'gamehub.log');
    }
    return this.logFilePath;
  }

  public static init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    const logPath = this.getLogPath();

    // Check log file size for rotation (10MB limit)
    try {
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        if (stats.size > 10 * 1024 * 1024) {
          const oldPath = `${logPath}.1`;
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          fs.renameSync(logPath, oldPath);
        }
      }
    } catch (e) {}

    this.info('App', '====================================================');
    this.info('App', `GameHub process started [PID: ${process.pid}] [Platform: ${process.platform}]`);
  }

  public static log(level: LogLevel, category: string, message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    let entry = `[${timestamp}] [${level}] [${category}] ${message}`;
    if (meta !== undefined) {
      try {
        entry += ` | ${typeof meta === 'object' ? JSON.stringify(meta) : String(meta)}`;
      } catch {
        entry += ` | [Non-serializable metadata]`;
      }
    }
    entry += '\n';

    // Console output
    if (level === 'ERROR') {
      console.error(entry.trim());
    } else if (level === 'WARN') {
      console.warn(entry.trim());
    } else {
      console.log(entry.trim());
    }

    // File append
    try {
      const logPath = this.getLogPath();
      fs.appendFileSync(logPath, entry, 'utf8');
    } catch (err: any) {
      // Avoid recursive failure
    }
  }

  public static info(category: string, message: string, meta?: any): void {
    this.log('INFO', category, message, meta);
  }

  public static warn(category: string, message: string, meta?: any): void {
    this.log('WARN', category, message, meta);
  }

  public static error(category: string, message: string, meta?: any): void {
    this.log('ERROR', category, message, meta);
  }
}
