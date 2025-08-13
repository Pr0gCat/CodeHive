import { ExecutorStatus } from '../../../lib/agents/project-executor';

describe('ProjectExecutor Types and Constants', () => {
  it('should have correct ExecutorStatus enum values', () => {
    expect(ExecutorStatus.STOPPED).toBe('stopped');
    expect(ExecutorStatus.STARTING).toBe('starting');
    expect(ExecutorStatus.RUNNING).toBe('running');
    expect(ExecutorStatus.PAUSING).toBe('pausing');
    expect(ExecutorStatus.PAUSED).toBe('paused');
    expect(ExecutorStatus.ERROR).toBe('error');
  });
});