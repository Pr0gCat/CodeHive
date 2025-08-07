import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { DatabaseSchemaValidator } from '@/lib/db/schema-validator';

export async function GET() {
  try {
    // Lazy load prisma to ensure it's initialized
    const { prisma } = await import('@/lib/db');
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    // Validate database schema
    const validator = new DatabaseSchemaValidator(prisma);
    const schemaValidation = await validator.validateSchema();

    if (!schemaValidation.isValid) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: 'schema_invalid',
          missingTables: schemaValidation.missingTables,
          error: 'Database schema validation failed',
        },
        { status: 500 }
      );
    }

    const schemaInfo = await validator.getSchemaInfo();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: {
        status: 'connected',
        schema: 'valid',
        tableCount: schemaInfo.totalTables,
      },
      version: '0.1.0',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
