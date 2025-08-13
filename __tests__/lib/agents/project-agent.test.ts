import { ProjectPhase, AgentState } from '../../../lib/agents/project-agent';

describe('ProjectAgent Types and Constants', () => {
  it('should have correct ProjectPhase enum values', () => {
    expect(ProjectPhase.REQUIREMENTS).toBe('requirements');
    expect(ProjectPhase.MVP).toBe('mvp');
    expect(ProjectPhase.CONTINUOUS).toBe('continuous');
  });

  it('should have correct AgentState enum values', () => {
    expect(AgentState.IDLE).toBe('idle');
    expect(AgentState.LISTENING).toBe('listening');
    expect(AgentState.PROCESSING).toBe('processing');
    expect(AgentState.WAITING_USER).toBe('waiting_user');
    expect(AgentState.EXECUTING).toBe('executing');
    expect(AgentState.ERROR).toBe('error');
  });
});