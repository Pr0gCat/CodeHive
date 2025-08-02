import { prisma } from '@/lib/db';
import { SprintManager } from './sprint-manager';

/**
 * Creates a default first sprint for a new project with README creation task
 */
export async function createDefaultFirstSprint(projectId: string, projectName: string) {
  const sprintManager = new SprintManager();
  
  // Calculate sprint dates (2 weeks from now)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + 14);
  
  try {
    // Create the first sprint
    const sprint = await sprintManager.createSprint({
      projectId,
      name: "Sprint 1 - Project Setup",
      goal: "Set up project documentation and initial structure",
      startDate,
      endDate,
      duration: 14, // 2 weeks
    });

    // Create Epic for "Project Documentation"
    const documentationEpic = await prisma.epic.create({
      data: {
        projectId,
        title: "Project Documentation",
        description: "Create comprehensive project documentation including README and technical guides",
        mvpPriority: "HIGH",
        status: "IN_PROGRESS",
        estimatedStoryPoints: 5,
        actualStoryPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create Claude Code /init task as the first story
    const claudeInitStory = await prisma.kanbanCard.create({
      data: {
        projectId,
        epicId: documentationEpic.id,
        sprintId: sprint.id,
        title: "Initialize project with Claude Code /init",
        description: `Run Claude Code /init command to set up the project foundation:
- Initialize project structure and configuration
- Set up development environment
- Create initial project files and directories
- Configure tooling and dependencies
- Establish coding standards and conventions

This task will leverage Claude Code's intelligent project initialization to create a solid foundation for ${projectName}.`,
        status: "TODO",
        position: 1,
        priority: "CRITICAL",
        storyPoints: 2,
        acceptanceCriteria: JSON.stringify([
          "Claude Code /init command executed successfully",
          "Project structure is properly initialized",
          "Development environment is configured",
          "Basic tooling and dependencies are set up",
          "Initial project files are created",
          "Configuration files are properly structured"
        ]),
        assignedAgent: "Project Manager Agent",
        tddEnabled: false, // This is a setup task, not a feature requiring TDD
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create README creation story
    const readmeStory = await prisma.kanbanCard.create({
      data: {
        projectId,
        epicId: documentationEpic.id,
        sprintId: sprint.id,
        title: "Create comprehensive README.md",
        description: `Create a detailed README.md file for ${projectName} that includes:
- Project overview and purpose
- Installation instructions
- Development setup guide
- Usage examples
- Contribution guidelines
- License information
- Tech stack documentation

This README should serve as the primary entry point for understanding and working with the project.`,
        status: "TODO",
        position: 2,
        priority: "HIGH",
        storyPoints: 3,
        acceptanceCriteria: JSON.stringify([
          "README.md contains comprehensive project overview",
          "Installation and setup instructions are clear and complete",
          "Code examples and usage patterns are provided",
          "Development workflow is documented",
          "Contributing guidelines are included",
          "Project structure is explained"
        ]),
        assignedAgent: "Project Manager Agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create technical documentation story
    const techDocsStory = await prisma.kanbanCard.create({
      data: {
        projectId,
        epicId: documentationEpic.id,
        sprintId: sprint.id,
        title: "Set up technical documentation structure",
        description: `Establish a comprehensive technical documentation structure:
- API documentation (if applicable)
- Architecture overview
- Development guidelines
- Testing strategies
- Deployment procedures

This will create a foundation for ongoing documentation efforts.`,
        status: "TODO",
        position: 3,
        priority: "MEDIUM",
        storyPoints: 2,
        acceptanceCriteria: JSON.stringify([
          "Documentation structure is established",
          "Basic API docs template is created (if applicable)",
          "Architecture overview document exists",
          "Development guidelines are documented",
          "Testing documentation is outlined"
        ]),
        assignedAgent: "Documentation Agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update sprint with planned story points
    await prisma.sprint.update({
      where: { id: sprint.id },
      data: {
        plannedStoryPoints: 7, // Total story points from all stories (2 + 3 + 2)
      },
    });

    // Create sprint-epic relationship
    await prisma.sprintEpic.create({
      data: {
        sprintId: sprint.id,
        epicId: documentationEpic.id,
        plannedStoryPoints: 7,
      },
    });

    console.log(`🚀 Created default first sprint for project ${projectName}:`);
    console.log(`   Sprint: ${sprint.name} (${sprint.id})`);
    console.log(`   Epic: ${documentationEpic.title} (${documentationEpic.id})`);
    console.log(`   Stories: Claude Code /init, README creation, Technical docs setup`);

    return {
      sprint,
      epic: documentationEpic,
      stories: [claudeInitStory, readmeStory, techDocsStory],
    };
  } catch (error) {
    console.error(`❌ Failed to create default first sprint for project ${projectName}:`, error);
    throw error;
  }
}