import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedProjectOverview } from '@/components/UnifiedProjectOverview';
import { mockProject, mockCycle, mockTest, mockArtifact } from '@/__tests__/helpers/test-utils';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useParams: () => ({ id: 'test-project-id' }),
}));

jest.mock('@/lib/socket/client', () => ({
  useSocket: () => ({
    socket: {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    },
    isConnected: true,
  }),
}));

const mockProjectWithRelations = {
  ...mockProject,
  cycles: [mockCycle],
  tests: [mockTest],
  artifacts: [mockArtifact],
  queries: [],
  _count: {
    cycles: 1,
    tests: 1,
    artifacts: 1,
    queries: 0,
  },
};

describe('UnifiedProjectOverview', () => {
  const defaultProps = {
    project: mockProjectWithRelations,
    stats: {
      totalTests: 1,
      passingTests: 0,
      failingTests: 1,
      totalArtifacts: 1,
      activeCycles: 1,
      completedCycles: 0,
      pendingQueries: 0,
    },
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render project information correctly', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Test project description')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('should display project statistics', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    expect(screen.getByText('1')).toBeInTheDocument(); // Total tests
    expect(screen.getByText('0')).toBeInTheDocument(); // Passing tests
    expect(screen.getByText('1')).toBeInTheDocument(); // Active cycles
  });

  it('should show project status badge', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    const statusBadge = screen.getByText('ACTIVE');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass('bg-green-100');
  });

  it('should display recent activity', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Test Feature')).toBeInTheDocument();
    expect(screen.getByText('should work correctly')).toBeInTheDocument();
  });

  it('should handle refresh action', async () => {
    const onRefresh = jest.fn();
    render(<UnifiedProjectOverview {...defaultProps} onRefresh={onRefresh} />);

    const refreshButton = screen.getByLabelText('Refresh project data');
    fireEvent.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should show empty state when no cycles exist', () => {
    const projectWithoutCycles = {
      ...mockProjectWithRelations,
      cycles: [],
      _count: {
        ...mockProjectWithRelations._count,
        cycles: 0,
      },
    };

    const statsWithoutCycles = {
      ...defaultProps.stats,
      activeCycles: 0,
      totalTests: 0,
    };

    render(
      <UnifiedProjectOverview
        project={projectWithoutCycles}
        stats={statsWithoutCycles}
        onRefresh={defaultProps.onRefresh}
      />
    );

    expect(screen.getByText('No TDD cycles yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first cycle to get started')).toBeInTheDocument();
  });

  it('should handle different project statuses', () => {
    const inactiveProject = {
      ...mockProjectWithRelations,
      status: 'INACTIVE',
    };

    render(
      <UnifiedProjectOverview
        {...defaultProps}
        project={inactiveProject}
      />
    );

    const statusBadge = screen.getByText('INACTIVE');
    expect(statusBadge).toHaveClass('bg-gray-100');
  });

  it('should display project path information', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    expect(screen.getByText('/test/project/path')).toBeInTheDocument();
  });

  it('should show loading state when data is being refreshed', async () => {
    const onRefresh = jest.fn().mockImplementation(() => {
      return new Promise(resolve => setTimeout(resolve, 100));
    });

    render(<UnifiedProjectOverview {...defaultProps} onRefresh={onRefresh} />);

    const refreshButton = screen.getByLabelText('Refresh project data');
    fireEvent.click(refreshButton);

    // Check for loading state indicators
    await waitFor(() => {
      expect(refreshButton).toBeDisabled();
    });
  });

  it('should handle error states gracefully', () => {
    const projectWithError = {
      ...mockProjectWithRelations,
      status: 'ERROR',
    };

    render(
      <UnifiedProjectOverview
        {...defaultProps}
        project={projectWithError}
      />
    );

    const statusBadge = screen.getByText('ERROR');
    expect(statusBadge).toHaveClass('bg-red-100');
  });

  it('should display technology stack information', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    expect(screen.getByText('Package Manager:')).toBeInTheDocument();
    expect(screen.getByText('bun')).toBeInTheDocument();
    expect(screen.getByText('Test Framework:')).toBeInTheDocument();
    expect(screen.getByText('jest')).toBeInTheDocument();
  });

  it('should show quick actions section', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('New Cycle')).toBeInTheDocument();
    expect(screen.getByText('Run Tests')).toBeInTheDocument();
    expect(screen.getByText('View Logs')).toBeInTheDocument();
  });

  it('should handle cycle phase transitions', () => {
    const cycleInGreenPhase = {
      ...mockCycle,
      phase: 'GREEN',
    };

    const projectWithGreenCycle = {
      ...mockProjectWithRelations,
      cycles: [cycleInGreenPhase],
    };

    render(
      <UnifiedProjectOverview
        {...defaultProps}
        project={projectWithGreenCycle}
      />
    );

    expect(screen.getByText('GREEN')).toBeInTheDocument();
  });

  it('should display progress indicators for active cycles', () => {
    render(<UnifiedProjectOverview {...defaultProps} />);

    // Check for progress indicators in the UI
    const progressSection = screen.getByText('Progress');
    expect(progressSection).toBeInTheDocument();
  });

  it('should handle project with multiple cycles', () => {
    const multipleCycles = [
      { ...mockCycle, id: 'cycle-1', title: 'First Cycle', phase: 'RED' },
      { ...mockCycle, id: 'cycle-2', title: 'Second Cycle', phase: 'GREEN' },
      { ...mockCycle, id: 'cycle-3', title: 'Third Cycle', phase: 'REFACTOR' },
    ];

    const projectWithMultipleCycles = {
      ...mockProjectWithRelations,
      cycles: multipleCycles,
      _count: {
        ...mockProjectWithRelations._count,
        cycles: 3,
      },
    };

    const statsWithMultipleCycles = {
      ...defaultProps.stats,
      activeCycles: 2,
      completedCycles: 1,
    };

    render(
      <UnifiedProjectOverview
        project={projectWithMultipleCycles}
        stats={statsWithMultipleCycles}
        onRefresh={defaultProps.onRefresh}
      />
    );

    expect(screen.getByText('First Cycle')).toBeInTheDocument();
    expect(screen.getByText('Second Cycle')).toBeInTheDocument();
    expect(screen.getByText('Third Cycle')).toBeInTheDocument();
  });
});
