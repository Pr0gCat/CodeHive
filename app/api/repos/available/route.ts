import { NextResponse } from 'next/server';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { getProjectDiscoveryService } from '@/lib/portable/project-discovery';

export async function GET() {
  try {
    const reposPath = join(process.cwd(), 'repos');

    // Check if repos directory exists
    try {
      statSync(reposPath);
    } catch {
      // If repos directory doesn't exist, return empty array
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Read all directories in repos/
    const allItems = readdirSync(reposPath);
    const folders = allItems.filter(item => {
      try {
        const itemPath = join(reposPath, item);
        return statSync(itemPath).isDirectory();
      } catch {
        return false;
      }
    });

    // Get all existing portable projects to filter out already indexed projects
    const discoveryService = getProjectDiscoveryService();
    const existingProjects = await discoveryService.discoverProjects({
      includeInvalid: false,
      validateMetadata: true,
    });

    // Create a set of existing paths for quick lookup
    const existingPaths = new Set(existingProjects.map(p => p.path));

    // Filter out folders that are already indexed as portable projects
    const availableFolders = folders
      .map(folder => {
        const fullPath = join(reposPath, folder);
        const relativePath = join('repos', folder);

        return {
          name: folder,
          path: fullPath,
          relativePath: relativePath,
          isAvailable: !existingPaths.has(fullPath),
        };
      })
      .filter(folder => folder.isAvailable)
      .map(folder => ({
        name: folder.name,
        path: folder.path,
        relativePath: folder.relativePath,
      }));

    // Also check for any git repositories and get their info
    const foldersWithInfo = availableFolders.map(folder => {
      try {
        const gitPath = join(folder.path, '.git');
        let hasGit = false;
        let gitUrl = null;

        try {
          statSync(gitPath);
          hasGit = true;

          // Try to read git config for remote URL
          try {
            const configPath = join(gitPath, 'config');
            const configContent = readFileSync(configPath, 'utf8');
            const urlMatch = configContent.match(/url = (.+)/);
            if (urlMatch) {
              gitUrl = urlMatch[1].trim();
            }
          } catch {
            // Git config not readable, continue without URL
          }
        } catch {
          // No .git directory
        }

        // Check for common project files to determine project type
        const projectFiles = readdirSync(folder.path);
        let projectType = 'Unknown';

        if (projectFiles.includes('package.json')) {
          projectType = 'Node.js/JavaScript';
        } else if (
          projectFiles.includes('requirements.txt') ||
          projectFiles.includes('pyproject.toml')
        ) {
          projectType = 'Python';
        } else if (projectFiles.includes('Cargo.toml')) {
          projectType = 'Rust';
        } else if (
          projectFiles.includes('pom.xml') ||
          projectFiles.includes('build.gradle')
        ) {
          projectType = 'Java';
        } else if (projectFiles.includes('go.mod')) {
          projectType = 'Go';
        }

        return {
          ...folder,
          hasGit,
          gitUrl,
          projectType,
          fileCount: projectFiles.length,
        };
      } catch {
        return {
          ...folder,
          hasGit: false,
          gitUrl: null,
          projectType: 'Unknown',
          fileCount: 0,
        };
      }
    });

    return NextResponse.json({
      success: true,
      data: foldersWithInfo,
    });
  } catch (error) {
    console.error('Error listing available repos:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list available repositories',
      },
      { status: 500 }
    );
  }
}
