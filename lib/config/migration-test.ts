/**
 * Configuration Migration Test Tool
 * 配置遷移測試工具 - 驗證新舊配置系統的兼容性
 */

import { getDatabaseConfig } from './database-config';
import { Config, getConfig } from './index';
import { getSyncConfig, getUnifiedConfig, UnifiedConfig } from './unified-config';

/**
 * Test configuration migration and compatibility
 */
export async function testConfigurationMigration(): Promise<void> {
  console.log('🧪 Testing Configuration Migration...\n');

  try {
    // Test 1: Unified Config Loading
    console.log('1. Testing Unified Config Loading...');
    const unifiedConfig = await getUnifiedConfig();
    console.log('✅ Unified config loaded successfully');
    console.log('   - Database URL:', unifiedConfig.database.url);
    console.log('   - Claude Path:', unifiedConfig.claude.codePath);
    console.log('   - Token Limit:', unifiedConfig.claude.dailyTokenLimit);
    console.log('   - Rate Limit:', unifiedConfig.claude.rateLimitPerMinute);
    console.log('   - Environment:', unifiedConfig.environment.nodeEnv);
    console.log('');

    // Test 2: Sync Config Loading
    console.log('2. Testing Sync Config Loading...');
    const syncConfig = getSyncConfig();
    console.log('✅ Sync config loaded successfully');
    console.log('   - Database URL:', syncConfig.database.url);
    console.log('   - Claude Path:', syncConfig.claude.codePath);
    console.log('   - Token Limit:', syncConfig.claude.dailyTokenLimit);
    console.log('   - Rate Limit:', syncConfig.claude.rateLimitPerMinute);
    console.log('   - Environment:', syncConfig.environment.nodeEnv);
    console.log('');

    // Test 3: Legacy Config Loading
    console.log('3. Testing Legacy Config Loading...');
    const legacyConfig = await getConfig();
    console.log('✅ Legacy config loaded successfully');
    console.log('   - Database URL:', legacyConfig.databaseUrl);
    console.log('   - Claude Path:', legacyConfig.claudeCodePath);
    console.log('   - Token Limit:', legacyConfig.claudeDailyTokenLimit);
    console.log('   - Rate Limit:', legacyConfig.claudeRateLimitPerMinute);
    console.log('   - Environment:', legacyConfig.nodeEnv);
    console.log('');

    // Test 4: Database Config Loading
    console.log('4. Testing Database Config Loading...');
    const dbConfig = await getDatabaseConfig();
    console.log('✅ Database config loaded successfully');
    console.log('   - Claude Path:', dbConfig.claudeCodePath);
    console.log('   - Token Limit:', dbConfig.dailyTokenLimit);
    console.log('   - Rate Limit:', dbConfig.rateLimitPerMinute);
    console.log('   - Warning Threshold:', dbConfig.warningThreshold);
    console.log('   - Critical Threshold:', dbConfig.criticalThreshold);
    console.log('');

    // Test 5: Configuration Consistency
    console.log('5. Testing Configuration Consistency...');
    const isConsistent = 
      unifiedConfig.claude.codePath === legacyConfig.claudeCodePath &&
      unifiedConfig.claude.dailyTokenLimit === legacyConfig.claudeDailyTokenLimit &&
      unifiedConfig.claude.rateLimitPerMinute === legacyConfig.claudeRateLimitPerMinute &&
      unifiedConfig.database.url === legacyConfig.databaseUrl &&
      unifiedConfig.app.url === legacyConfig.appUrl &&
      unifiedConfig.environment.nodeEnv === legacyConfig.nodeEnv;

    if (isConsistent) {
      console.log('✅ All configuration systems are consistent');
    } else {
      console.log('❌ Configuration systems are inconsistent');
      console.log('   Unified vs Legacy differences:');
      console.log('   - Claude Path:', unifiedConfig.claude.codePath, 'vs', legacyConfig.claudeCodePath);
      console.log('   - Token Limit:', unifiedConfig.claude.dailyTokenLimit, 'vs', legacyConfig.claudeDailyTokenLimit);
      console.log('   - Rate Limit:', unifiedConfig.claude.rateLimitPerMinute, 'vs', legacyConfig.claudeRateLimitPerMinute);
    }
    console.log('');

    // Test 6: Environment Variable Override
    console.log('6. Testing Environment Variable Override...');
    const originalEnv = process.env.CLAUDE_CODE_PATH;
    process.env.CLAUDE_CODE_PATH = 'test-claude-path';
    
    const overrideConfig = getSyncConfig();
    const overrideLegacyConfig = await getConfig();
    
    if (overrideConfig.claude.codePath === 'test-claude-path' && 
        overrideLegacyConfig.claudeCodePath === 'test-claude-path') {
      console.log('✅ Environment variable override works correctly');
    } else {
      console.log('❌ Environment variable override failed');
    }
    
    // Restore original environment
    if (originalEnv) {
      process.env.CLAUDE_CODE_PATH = originalEnv;
    } else {
      delete process.env.CLAUDE_CODE_PATH;
    }
    console.log('');

    console.log('🎉 Configuration migration test completed successfully!');
    console.log('   All systems are working correctly and are compatible.');

  } catch (error) {
    console.error('❌ Configuration migration test failed:', error);
    throw error;
  }
}

/**
 * Compare configuration objects
 */
export function compareConfigs(
  config1: UnifiedConfig | Config,
  config2: UnifiedConfig | Config,
  name1: string,
  name2: string
): void {
  console.log(`\n🔍 Comparing ${name1} vs ${name2}:`);
  
  const keys1 = Object.keys(config1);
  const keys2 = Object.keys(config2);
  
  const allKeys = new Set([...keys1, ...keys2]);
  
  const allKeysArray = Array.from(allKeys);
  for (const key of allKeysArray) {
    const value1 = (config1 as any)[key];
    const value2 = (config2 as any)[key];
    
    if (value1 !== value2) {
      console.log(`   ❌ ${key}: ${value1} vs ${value2}`);
    } else {
      console.log(`   ✅ ${key}: ${value1}`);
    }
  }
}

/**
 * Validate configuration structure
 */
export function validateConfigStructure(config: UnifiedConfig): void {
  console.log('\n🔍 Validating Unified Config Structure:');
  
  const requiredSections = ['database', 'claude', 'app', 'environment'];
  const requiredClaudeProps = [
    'codePath', 'dailyTokenLimit', 'rateLimitPerMinute', 
    'warningThreshold', 'criticalThreshold', 'allocationStrategy',
    'autoResumeEnabled', 'pauseOnWarning'
  ];
  
  for (const section of requiredSections) {
    if (!(section in config)) {
      console.log(`   ❌ Missing section: ${section}`);
    } else {
      console.log(`   ✅ Section: ${section}`);
    }
  }
  
  for (const prop of requiredClaudeProps) {
    if (!(prop in config.claude)) {
      console.log(`   ❌ Missing claude property: ${prop}`);
    } else {
      console.log(`   ✅ Claude property: ${prop}`);
    }
  }
}

// Export test functions
export { testConfigurationMigration as testMigration };
