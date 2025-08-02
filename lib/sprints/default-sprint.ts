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
        priority: "HIGH",
        status: "IN_PROGRESS",
        estimatedStoryPoints: 5,
        actualStoryPoints: 0,
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
        type: "STORY",
        status: "TODO",
        priority: "HIGH",
        storyPoints: 3,
        acceptanceCriteria: [
          "README.md contains comprehensive project overview",
          "Installation and setup instructions are clear and complete",
          "Code examples and usage patterns are provided",
          "Development workflow is documented",
          "Contributing guidelines are included",
          "Project structure is explained"
        ],
        tags: ["documentation", "readme", "setup"],
        assignee: "Project Manager Agent",
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
        type: "STORY",
        status: "TODO",
        priority: "MEDIUM",
        storyPoints: 2,
        acceptanceCriteria: [
          "Documentation structure is established",
          "Basic API docs template is created (if applicable)",
          "Architecture overview document exists",
          "Development guidelines are documented",
          "Testing documentation is outlined"
        ],
        tags: ["documentation", "technical", "architecture"],
        assignee: "Documentation Agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update sprint with planned story points
    await prisma.sprint.update({
      where: { id: sprint.id },
      data: {
        plannedStoryPoints: 5, // Total story points from both stories
      },
    });

    // Create sprint-epic relationship
    await prisma.sprintEpic.create({
      data: {
        sprintId: sprint.id,
        epicId: documentationEpic.id,
        plannedStoryPoints: 5,
      },
    });

    console.log(`🚀 Created default first sprint for project ${projectName}:`);
    console.log(`   Sprint: ${sprint.name} (${sprint.id})`);
    console.log(`   Epic: ${documentationEpic.title} (${documentationEpic.id})`);
    console.log(`   Stories: README creation, Technical docs setup`);

    return {
      sprint,
      epic: documentationEpic,
      stories: [readmeStory, techDocsStory],
    };
  } catch (error) {
    console.error(`❌ Failed to create default first sprint for project ${projectName}:`, error);
    throw error;
  }
}