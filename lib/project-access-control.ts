import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function checkProjectOperationAccess(projectId: string) {
  try {
    const project = await prisma.projectIndex.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, status: true, localPath: true },
    });

    if (!project) {
      return {
        allowed: false,
        response: NextResponse.json(
          { success: false, error: 'Project not found' },
          { status: 404 }
        ),
      };
    }

    if (project.status === 'INITIALIZING') {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            success: false,
            error:
              'Project is still initializing. Please wait for initialization to complete.',
            code: 'PROJECT_INITIALIZING',
            project: {
              id: project.id,
              name: project.name,
              status: project.status,
            },
          },
          { status: 423 } // 423 Locked
        ),
      };
    }

    if (project.status === 'ARCHIVED') {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            success: false,
            error: 'Project is archived and cannot be modified.',
            code: 'PROJECT_ARCHIVED',
            project: {
              id: project.id,
              name: project.name,
              status: project.status,
            },
          },
          { status: 423 } // 423 Locked
        ),
      };
    }

    return {
      allowed: true,
      project,
    };
  } catch (error) {
    console.error('Error checking project access:', error);
    return {
      allowed: false,
      response: NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}

export async function requireActiveProject(projectId: string) {
  const accessCheck = await checkProjectOperationAccess(projectId);

  if (!accessCheck.allowed) {
    throw new Error('Project access denied');
  }

  return accessCheck.project;
}
