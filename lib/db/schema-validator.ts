import { PrismaClient } from '@prisma/client'

export class DatabaseSchemaValidator {
  private prisma: PrismaClient

  // Required tables for the portable project system
  private readonly REQUIRED_TABLES = [
    // Core portable project system
    'project_index',
    'global_settings',
    
    // Task execution system (used for real-time operations)
    'task_executions',
    'task_phases', 
    'task_events',
    
    // Token management (still used for system-wide tracking)
    'token_usage'
  ]

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Validates that all required tables exist in the database
   * @returns Promise<ValidationResult>
   */
  async validateSchema(): Promise<{
    isValid: boolean
    missingTables: string[]
    existingTables: string[]
    error?: string
  }> {
    try {
      // Get all existing tables from SQLite schema
      const result = await this.prisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_prisma_migrations'
      `
      
      const existingTables = result.map(row => row.name)
      const missingTables = this.REQUIRED_TABLES.filter(
        required => !existingTables.includes(required)
      )
      
      return {
        isValid: missingTables.length === 0,
        missingTables,
        existingTables
      }
    } catch (error) {
      return {
        isValid: false,
        missingTables: [],
        existingTables: [],
        error: error instanceof Error ? error.message : 'Unknown database error'
      }
    }
  }

  /**
   * Validates database schema and exits process if validation fails
   */
  async validateOrExit(): Promise<void> {
    console.log('🔍 Validating database schema...')
    
    const validation = await this.validateSchema()
    
    if (validation.error) {
      console.error('❌ Database connection failed:', validation.error)
      console.error('Please check your database configuration and try again.')
      process.exit(1)
    }
    
    if (!validation.isValid) {
      console.error('❌ Database schema validation failed!')
      console.error(`Missing required tables: ${validation.missingTables.join(', ')}`)
      console.error('')
      console.error('This usually means:')
      console.error('1. Database needs to be migrated: run `bun run db:migrate`')
      console.error('2. Database was corrupted or manually modified')
      console.error('3. Application was updated but database was not migrated')
      console.error('')
      console.error('Please run database setup: `bun run db:setup`')
      process.exit(1)
    }
    
    console.log('✅ Database schema validation passed')
    console.log(`Found ${validation.existingTables.length} tables in database`)
  }

  /**
   * Get detailed schema information for debugging
   */
  async getSchemaInfo(): Promise<{
    tables: Array<{
      name: string
      sql: string
    }>
    totalTables: number
  }> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ name: string; sql: string }>>`
        SELECT name, sql FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `
      
      return {
        tables: result,
        totalTables: result.length
      }
    } catch (error) {
      throw new Error(`Failed to get schema info: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// Helper function to create and run validation
export async function validateDatabaseSchema(prisma: PrismaClient): Promise<void> {
  const validator = new DatabaseSchemaValidator(prisma)
  await validator.validateOrExit()
}