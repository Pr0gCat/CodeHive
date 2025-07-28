-- Migration to rename 'default*' columns to 'preferred*' in global_settings table

ALTER TABLE global_settings RENAME COLUMN defaultFramework TO preferredFramework;
ALTER TABLE global_settings RENAME COLUMN defaultLanguage TO preferredLanguage;
ALTER TABLE global_settings RENAME COLUMN defaultPackageManager TO preferredPackageManager;
ALTER TABLE global_settings RENAME COLUMN defaultTestFramework TO preferredTestFramework;
ALTER TABLE global_settings RENAME COLUMN defaultLintTool TO preferredLintTool;
ALTER TABLE global_settings RENAME COLUMN defaultBuildTool TO preferredBuildTool;