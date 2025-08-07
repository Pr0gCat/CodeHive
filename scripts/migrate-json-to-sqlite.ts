#!/usr/bin/env tsx
/**
 * Migration script to convert JSON-based portable projects to SQLite format
 * Usage: tsx scripts/migrate-json-to-sqlite.ts [options]
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { ProjectMetadataManager } from '../lib/portable/metadata-manager';
import { SQLiteMetadataManager } from '../lib/portable/sqlite-metadata-manager';
import { PortableProject, PortableProjectSchema } from '../lib/portable/schemas';

const program = new Command();

program
  .name('migrate-json-to-sqlite')
  .description('Convert JSON-based portable projects to SQLite format')
  .option('-p, --project <path>', 'Migrate specific project by path')
  .option('-a, --all', 'Migrate all projects in repos/ directory')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .option('--backup', 'Create backup before migration (default: true)')
  .option('--force', 'Overwrite existing SQLite databases')
  .option('-v, --verbose', 'Show detailed migration progress')
  .parse();

const options = program.getOpts();

interface MigrationResult {
  projectPath: string;
  success: boolean;
  error?: string;
  stats?: Record<string, number>;
}

async function findPortableProjects(baseDir: string): Promise<string[]> {
  const projects: string[] = [];
  
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(baseDir, entry.name);
        const codehivePath = path.join(projectPath, '.codehive');
        const projectJsonPath = path.join(codehivePath, 'project.json');
        
        try {
          // Check if it's a JSON-based portable project
          await fs.access(projectJsonPath);
          
          // Check if SQLite database already exists
          const sqlitePath = path.join(codehivePath, 'project.db');
          try {
            await fs.access(sqlitePath);
            if (!options.force) {
              if (options.verbose) {
                console.log(`⚠️  Skipping ${projectPath} - SQLite database already exists (use --force to overwrite)`);
              }
              continue;
            }
          } catch {
            // SQLite database doesn't exist, good to migrate
          }
          
          projects.push(projectPath);
        } catch {
          // Not a JSON-based portable project, skip
        }
      }
    }
  } catch (error: any) {
    console.error(`Error scanning directory ${baseDir}:`, error.message);
  }
  
  return projects;
}

async function migrateProject(projectPath: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    projectPath,
    success: false,
  };

  try {
    if (options.verbose) {
      console.log(`📦 Migrating project: ${path.basename(projectPath)}`);
      console.log(`   Path: ${projectPath}`);
    }

    // Create backup if requested (default: true)
    if (options.backup !== false) {
      await createBackup(projectPath);
    }

    // Load data from JSON-based manager
    const jsonManager = new ProjectMetadataManager(projectPath);
    const portableProject = await jsonManager.exportPortableProject();
    
    // Validate the exported data
    PortableProjectSchema.parse(portableProject);

    if (options.dryRun) {
      console.log(`✅ DRY RUN: Would migrate ${path.basename(projectPath)}`);
      console.log(`   - ${portableProject.epics.length} epics`);
      console.log(`   - ${portableProject.stories.length} stories`);
      console.log(`   - ${portableProject.sprints.length} sprints`);
      console.log(`   - ${portableProject.agents.length} agents`);
      console.log(`   - ${portableProject.cycles.length} cycles`);
      console.log(`   - ${portableProject.tokenUsage.length} token usage records`);
      
      result.success = true;
      result.stats = {
        epics: portableProject.epics.length,
        stories: portableProject.stories.length,
        sprints: portableProject.sprints.length,
        agents: portableProject.agents.length,
        cycles: portableProject.cycles.length,
        tokenUsage: portableProject.tokenUsage.length,
      };
      return result;
    }

    // Create SQLite-based manager and import data
    const sqliteManager = new SQLiteMetadataManager(projectPath);
    await sqliteManager.initialize();
    await sqliteManager.importPortableProject(portableProject);

    // Verify migration by getting stats
    const stats = await sqliteManager.getStats();
    
    if (options.verbose) {
      console.log(`✅ Migration completed successfully`);
      console.log(`   Database created at: ${path.join(projectPath, '.codehive', 'project.db')}`);
      console.log(`   Records migrated:`);
      Object.entries(stats).forEach(([table, count]) => {
        if (count > 0) {
          console.log(`     - ${table}: ${count}`);
        }
      });
    }

    sqliteManager.close();

    result.success = true;
    result.stats = stats;

  } catch (error: any) {
    result.error = error.message;
    if (options.verbose) {
      console.error(`❌ Migration failed: ${error.message}`);
      console.error(error.stack);
    }
  }

  return result;
}

async function createBackup(projectPath: string): Promise<void> {
  const codehivePath = path.join(projectPath, '.codehive');
  const backupDir = path.join(codehivePath, 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `json-backup-${timestamp}`);

  await fs.mkdir(backupPath, { recursive: true });

  // List of files/directories to backup
  const itemsToBackup = [
    'project.json',
    'settings.json',
    'budget.json',
    'epics/',
    'stories/',
    'sprints/',
    'agents/',
    'cycles/',
    'usage/',
  ];

  for (const item of itemsToBackup) {
    const sourcePath = path.join(codehivePath, item);
    const targetPath = path.join(backupPath, item);
    
    try {
      const stat = await fs.stat(sourcePath);
      
      if (stat.isDirectory()) {
        await fs.cp(sourcePath, targetPath, { recursive: true });
      } else if (stat.isFile()) {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
      }
    } catch {
      // Item doesn't exist, skip
    }
  }

  if (options.verbose) {
    console.log(`📋 Created backup at: ${backupPath}`);
  }
}

async function main() {
  console.log('🔄 CodeHive JSON to SQLite Migration Tool\n');

  let projectPaths: string[] = [];

  if (options.project) {
    // Migrate specific project
    const projectPath = path.resolve(options.project);
    try {
      await fs.access(projectPath);
      projectPaths = [projectPath];
    } catch {
      console.error(`❌ Project path does not exist: ${projectPath}`);
      process.exit(1);
    }
  } else if (options.all) {
    // Migrate all projects in repos/ directory
    const reposDir = path.join(process.cwd(), 'repos');
    try {
      projectPaths = await findPortableProjects(reposDir);
      
      if (projectPaths.length === 0) {
        console.log('ℹ️  No JSON-based portable projects found in repos/ directory');
        process.exit(0);
      }
      
      console.log(`Found ${projectPaths.length} JSON-based portable project(s) to migrate:`);
      projectPaths.forEach((p, i) => {
        console.log(`  ${i + 1}. ${path.basename(p)} (${p})`);
      });
      console.log();
    } catch {
      console.error(`❌ Cannot access repos directory: ${reposDir}`);
      process.exit(1);
    }
  } else {
    console.error('❌ Must specify either --project <path> or --all');
    program.help();
  }

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\\n');
  }

  // Perform migrations
  const results: MigrationResult[] = [];
  
  for (let i = 0; i < projectPaths.length; i++) {
    const projectPath = projectPaths[i];
    const projectName = path.basename(projectPath);
    
    console.log(`[${i + 1}/${projectPaths.length}] ${projectName}...`);
    
    const result = await migrateProject(projectPath);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${projectName}`);
    } else {
      console.log(`❌ ${projectName}: ${result.error}`);
    }
  }

  // Summary
  console.log(`\\n📊 Migration Summary:`);
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`  ✅ Successful: ${successful}`);
  if (failed > 0) {
    console.log(`  ❌ Failed: ${failed}`);
    
    console.log(`\\n❌ Failed Projects:`);
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`     ${path.basename(r.projectPath)}: ${r.error}`);
      });
  }

  if (options.verbose && successful > 0) {
    console.log(`\\n📈 Migration Statistics:`);
    const totalStats: Record<string, number> = {};
    
    results
      .filter(r => r.success && r.stats)
      .forEach(r => {
        Object.entries(r.stats!).forEach(([key, value]) => {
          totalStats[key] = (totalStats[key] || 0) + value;
        });
      });

    Object.entries(totalStats)
      .filter(([, count]) => count > 0)
      .forEach(([table, count]) => {
        console.log(`     ${table}: ${count} records`);
      });
  }

  if (!options.dryRun) {
    console.log(`\\n✨ Migration completed! Projects now use SQLite databases in .codehive/project.db`);
    console.log(`   Backups created in .codehive/backups/ directories`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('\\n💥 Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the migration
main().catch((error) => {
  console.error('\\n💥 Migration failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});