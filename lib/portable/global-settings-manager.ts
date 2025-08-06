/**
 * Global Settings Manager for Portable System
 * Manages global CodeHive settings stored in .codehive/global directory
 */

import { promises as fs } from 'fs';
import path from 'path';
import { GlobalSettings, GlobalSettingsSchema } from './schemas';

export class GlobalSettingsManager {
  private globalDir: string;
  private settingsPath: string;

  constructor() {
    // Store global settings in .codehive/global/ directory at project root
    this.globalDir = path.join(process.cwd(), '.codehive', 'global');
    this.settingsPath = path.join(this.globalDir, 'settings.json');
  }

  /**
   * Initialize global settings directory
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.globalDir, { recursive: true });
  }

  /**
   * Get global settings, creating defaults if they don't exist
   */
  async getGlobalSettings(): Promise<GlobalSettings> {
    try {
      await fs.access(this.settingsPath);
      const content = await fs.readFile(this.settingsPath, 'utf-8');
      const data = JSON.parse(content);
      return GlobalSettingsSchema.parse(data);
    } catch {
      // Settings file doesn't exist, create default settings
      const defaultSettings: GlobalSettings = {
        id: 'global',
        dailyTokenLimit: 100000000, // 100M tokens
        warningThreshold: 0.75, // 75%
        criticalThreshold: 0.9, // 90%
        allocationStrategy: 0.5, // 50% mix
        autoResumeEnabled: true,
        pauseOnWarning: false,
        claudeCodePath: 'claude',
        rateLimitPerMinute: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.saveGlobalSettings(defaultSettings);
      return defaultSettings;
    }
  }

  /**
   * Save global settings to file
   */
  async saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    // Ensure directory exists
    await this.initialize();

    // Validate settings
    const validatedSettings = GlobalSettingsSchema.parse({
      ...settings,
      updatedAt: new Date().toISOString(),
    });

    // Write to file with pretty formatting
    const content = JSON.stringify(validatedSettings, null, 2);
    await fs.writeFile(this.settingsPath, content, 'utf-8');
  }

  /**
   * Update global settings
   */
  async updateGlobalSettings(updates: Partial<Omit<GlobalSettings, 'id' | 'createdAt'>>): Promise<GlobalSettings> {
    const currentSettings = await this.getGlobalSettings();
    
    const updatedSettings: GlobalSettings = {
      ...currentSettings,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveGlobalSettings(updatedSettings);
    return updatedSettings;
  }

  /**
   * Check if global settings exist
   */
  async settingsExist(): Promise<boolean> {
    try {
      await fs.access(this.settingsPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset global settings to defaults
   */
  async resetToDefaults(): Promise<GlobalSettings> {
    const defaultSettings: GlobalSettings = {
      id: 'global',
      dailyTokenLimit: 100000000,
      warningThreshold: 0.75,
      criticalThreshold: 0.9,
      allocationStrategy: 0.5,
      autoResumeEnabled: true,
      pauseOnWarning: false,
      claudeCodePath: 'claude',
      rateLimitPerMinute: 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveGlobalSettings(defaultSettings);
    return defaultSettings;
  }
}

// Singleton instance for global use
export const globalSettingsManager = new GlobalSettingsManager();