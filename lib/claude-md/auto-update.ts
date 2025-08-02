import { ClaudeCodeExecutor } from '@/lib/claude-code';

export interface CLAUDEMDUpdate {
  trigger: 'TASK_COMPLETION' | 'EPIC_COMPLETION' | 'QUERY_RESOLUTION';
  taskId?: string;
  epicId?: string;
  queryId?: string;
  details: {
    title: string;
    description: string;
    implementationDetails?: string[];
    newPatterns?: string[];
    dependencies?: string[];
    testingApproach?: string;
    userDecisions?: string[];
    architectureChanges?: string[];
  };
}

export class CLAUDEMDAutoUpdater {
  private claudeExecutor: ClaudeCodeExecutor;

  constructor() {
    this.claudeExecutor = new ClaudeCodeExecutor();
  }

  async updateAfterTaskCompletion(update: CLAUDEMDUpdate): Promise<void> {
    const command = this.generateTaskCompletionCommand(update);
    await this.executeCLAUDEMDUpdate(command);
  }

  async updateAfterEpicCompletion(update: CLAUDEMDUpdate): Promise<void> {
    const command = this.generateEpicCompletionCommand(update);
    await this.executeCLAUDEMDUpdate(command);
  }

  async updateAfterQueryResolution(update: CLAUDEMDUpdate): Promise<void> {
    const command = this.generateQueryResolutionCommand(update);
    await this.executeCLAUDEMDUpdate(command);
  }

  private generateTaskCompletionCommand(update: CLAUDEMDUpdate): string {
    const details = update.details;
    
    return `Please update CLAUDE.md with the following completed work:

**Completed**: ${details.title}

**Implementation Details**:
${details.implementationDetails?.map(detail => `- ${detail}`).join('\n') || 'No specific implementation details provided.'}

**New Patterns Established**:
${details.newPatterns?.map(pattern => `- ${pattern}`).join('\n') || 'No new patterns established.'}

**Dependencies Added**:
${details.dependencies?.map(dep => `- ${dep}`).join('\n') || 'No new dependencies added.'}

**Testing Approach**:
${details.testingApproach || 'Standard TDD testing approach applied.'}

${details.architectureChanges?.length ? `
**Architecture Changes**:
${details.architectureChanges.map(change => `- ${change}`).join('\n')}
` : ''}

Please update the relevant sections of CLAUDE.md to reflect this work and maintain the project context for future development.`;
  }

  private generateEpicCompletionCommand(update: CLAUDEMDUpdate): string {
    const details = update.details;
    
    return `Please update CLAUDE.md with the completion of a major epic:

**Epic Completed**: ${details.title}

**Features Implemented**:
${details.implementationDetails?.map(feature => `- ${feature}`).join('\n') || 'Feature details not provided.'}

**Architecture Established**:
${details.architectureChanges?.map(change => `- ${change}`).join('\n') || 'No major architecture changes.'}

**New Patterns Established**:
${details.newPatterns?.map(pattern => `- ${pattern}`).join('\n') || 'No new patterns established.'}

**Dependencies Added**:
${details.dependencies?.map(dep => `- ${dep}`).join('\n') || 'No new dependencies.'}

**User Decisions Made**:
${details.userDecisions?.map(decision => `- ${decision}`).join('\n') || 'No specific user decisions recorded.'}

Please update CLAUDE.md to reflect this major milestone and all associated patterns. Update the project status and current focus areas.`;
  }

  private generateQueryResolutionCommand(update: CLAUDEMDUpdate): string {
    const details = update.details;
    
    return `Please update CLAUDE.md with the following user decision:

**Query Resolved**: ${details.title}

**User Decision**: ${details.description}

**Implemented Solution**:
${details.implementationDetails?.map(detail => `- ${detail}`).join('\n') || 'Solution details not provided.'}

**User Preferences Identified**:
${details.userDecisions?.map(pref => `- ${pref}`).join('\n') || 'No specific preferences identified.'}

**Architecture Impact**:
${details.architectureChanges?.map(change => `- ${change}`).join('\n') || 'No architecture changes required.'}

Please update CLAUDE.md to document this decision and the user's preferences for future development decisions.`;
  }

  private async executeCLAUDEMDUpdate(command: string): Promise<void> {
    try {
      console.log('🤖 Instructing Claude Code to update CLAUDE.md...');
      console.log('Command:', command.slice(0, 200) + '...');

      // Execute the Claude Code command to update CLAUDE.md
      const result = await this.claudeExecutor.executeCommand(command, {
        expectedResponse: 'CLAUDE.md_UPDATE_CONFIRMATION',
        timeout: 60000, // 1 minute timeout for documentation updates
      });

      if (result.success) {
        console.log('✅ CLAUDE.md updated successfully');
      } else {
        console.error('❌ Failed to update CLAUDE.md:', result.error);
      }
    } catch (error) {
      console.error('Error updating CLAUDE.md:', error);
      // Don't throw - documentation updates shouldn't break the main flow
    }
  }
}

// Convenience functions for common update scenarios
export const claudeMDUpdater = new CLAUDEMDAutoUpdater();

export async function updateCLAUDEMDAfterTask(
  taskId: string,
  title: string,
  description: string,
  options: {
    implementationDetails?: string[];
    newPatterns?: string[];
    dependencies?: string[];
    testingApproach?: string;
    architectureChanges?: string[];
  } = {}
): Promise<void> {
  await claudeMDUpdater.updateAfterTaskCompletion({
    trigger: 'TASK_COMPLETION',
    taskId,
    details: {
      title,
      description,
      ...options,
    },
  });
}

export async function updateCLAUDEMDAfterEpic(
  epicId: string,
  title: string,
  description: string,
  options: {
    implementationDetails?: string[];
    newPatterns?: string[];
    dependencies?: string[];
    userDecisions?: string[];
    architectureChanges?: string[];
  } = {}
): Promise<void> {
  await claudeMDUpdater.updateAfterEpicCompletion({
    trigger: 'EPIC_COMPLETION',
    epicId,
    details: {
      title,
      description,
      ...options,
    },
  });
}

export async function updateCLAUDEMDAfterQuery(
  queryId: string,
  question: string,
  decision: string,
  options: {
    implementationDetails?: string[];
    userDecisions?: string[];
    architectureChanges?: string[];
  } = {}
): Promise<void> {
  await claudeMDUpdater.updateAfterQueryResolution({
    trigger: 'QUERY_RESOLUTION',
    queryId,
    details: {
      title: question,
      description: decision,
      ...options,
    },
  });
}