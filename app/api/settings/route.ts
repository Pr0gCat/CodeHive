import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const settingsSchema = z.object({
  preferredFramework: z.string().optional(),
  preferredLanguage: z.string().optional(),
  preferredPackageManager: z.string().optional(),
  preferredTestFramework: z.string().optional(),
  preferredLintTool: z.string().optional(),
  preferredBuildTool: z.string().optional(),
});

export async function GET() {
  try {
    let settings = await prisma.globalSettings.findUnique({
      where: { id: 'global' },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: {
          id: 'global',
          preferredFramework: '',
          preferredLanguage: '',
          preferredPackageManager: '',
          preferredTestFramework: '',
          preferredLintTool: '',
          preferredBuildTool: '',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch settings',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = settingsSchema.parse(body);

    const settings = await prisma.globalSettings.upsert({
      where: { id: 'global' },
      update: validatedData,
      create: {
        id: 'global',
        ...validatedData,
      },
    });

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error updating settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update settings',
      },
      { status: 500 }
    );
  }
}