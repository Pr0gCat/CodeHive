#!/usr/bin/env tsx

/**
 * CLI Migration Script - Convert existing CodeHive projects to portable format
 * 
 * Usage:
 *   tsx scripts/migrate-to-portable.ts [options]
 *   
 * Options:
 *   --all                Migrate all projects
 *   --project <id>       Migrate specific project by ID
 *   --dry-run           Show what would be migrated without making changes
 *   --backup            Create backups before migration (default: true)
 *   --validate          Validate projects after migration (default: true)
 *   --report <path>     Save migration report to file
 *   --help              Show help
 */

import { Command } from 'commander';
import { ProjectMigrationService } from '../lib/portable/migration';
import { getProjectDiscoveryService } from '../lib/portable/project-discovery';
import { validateMultipleProjects } from '../lib/portable/validation';
import { prisma } from '../lib/db';
import { promises as fs } from 'fs';
import path from 'path';

const program = new Command();

program
  .name('migrate-to-portable')
  .description('Migrate CodeHive projects to portable format')
  .version('1.0.0');

program
  .option('-a, --all', 'Migrate all projects')
  .option('-p, --project <id>', 'Migrate specific project by ID')
  .option('-d, --dry-run', 'Show what would be migrated without making changes')
  .option('-b, --backup', 'Create backups before migration', true)
  .option('-v, --validate', 'Validate projects after migration', true)
  .option('-r, --report <path>', 'Save migration report to file')
  .option('-h, --help', 'Show help');

async function main() {
  const options = program.parse().opts();

  if (options.help) {
    program.help();
    return;
  }

  console.log('🚀 CodeHive Portable Project Migration Tool\n');

  const migrationService = new ProjectMigrationService();

  try {
    let results;

    if (options.all) {
      console.log('📋 Migrating all projects...\n');
      results = await migrationService.migrateAllProjects({
        dryRun: options.dryRun,
        backupOriginal: options.backup,
        validateOutput: options.validate,
      });
    } else if (options.project) {
      console.log(`📋 Migrating project: ${options.project}\n`);
      const result = await migrationService.migrateProject(options.project, {
        dryRun: options.dryRun,
        backupOriginal: options.backup,
        validateOutput: options.validate,
      });
      results = [result];
    } else {
      console.error('❌ Error: Please specify --all or --project <id>');
      program.help();
      return;
    }

    // Display results
    console.log('\n📊 Migration Results:');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📈 Total: ${results.length}\n`);

    if (successful.length > 0) {
      console.log('✅ Successfully migrated:');
      for (const result of successful) {
        console.log(`   • ${result.projectName} (${result.projectId})`);
        console.log(`     - Epics: ${result.migratedEntities.epics}`);
        console.log(`     - Stories: ${result.migratedEntities.stories}`);
        console.log(`     - Sprints: ${result.migratedEntities.sprints}`);
        console.log(`     - Agents: ${result.migratedEntities.agents}`);
        console.log(`     - Cycles: ${result.migratedEntities.cycles}`);
        console.log(`     - Token Usage: ${result.migratedEntities.tokenUsage}\n`);
      }
    }

    if (failed.length > 0) {
      console.log('❌ Failed migrations:');
      for (const result of failed) {
        console.log(`   • ${result.projectName} (${result.projectId}): ${result.error}\n`);
      }
    }

    // Post-migration validation
    if (options.validate && successful.length > 0 && !options.dryRun) {
      console.log('🔍 Validating migrated projects...\n');
      
      const discoveryService = getProjectDiscoveryService();
      const portableProjects = await discoveryService.discoverProjects();
      
      const migratedProjectPaths = successful
        .map(r => portableProjects.find(p => p.metadata.id === r.projectId)?.path)
        .filter(Boolean) as string[];

      if (migratedProjectPaths.length > 0) {
        const validationSummary = await validateMultipleProjects(migratedProjectPaths);
        
        console.log('🔍 Validation Summary:');
        console.log(`   • Valid projects: ${validationSummary.validProjects}`);
        console.log(`   • Invalid projects: ${validationSummary.invalidProjects}`);
        console.log(`   • Total issues: ${validationSummary.totalIssues}\n`);
        
        if (validationSummary.invalidProjects > 0) {
          console.log('⚠️  Projects with validation issues:');
          for (const result of validationSummary.results) {
            if (!result.isValid) {
              console.log(`   • ${result.path} (${result.issueCount} issues)`);
            }
          }
          console.log();
        }
      }
    }

    // Generate and save report
    if (options.report || options.dryRun) {
      const report = migrationService.generateMigrationReport(results);
      
      if (options.report) {
        await fs.writeFile(options.report, report);
        console.log(`📝 Migration report saved to: ${options.report}\n`);
      } else if (options.dryRun) {
        console.log('\n📝 Migration Report (Dry Run):');
        console.log('='.repeat(50));
        console.log(report);
      }
    }

    // Final summary
    if (!options.dryRun) {
      console.log('🎉 Migration completed!');
      
      if (successful.length > 0) {
        console.log('\n📁 Your projects are now portable and can be found in the repos/ directory.');
        console.log('🔄 Each project now contains a .codehive/ directory with all metadata.');
        console.log('📦 Projects can be moved between CodeHive installations.');
        console.log('\n💡 Next steps:');
        console.log('   • Test your migrated projects');
        console.log('   • Consider backing up the original database');
        console.log('   • Update your workflow to use portable projects');
      }
    } else {
      console.log('\n🏃 This was a dry run - no changes were made.');
      console.log('   Remove --dry-run to perform the actual migration.');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle CLI execution
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { main as migrationCLI };