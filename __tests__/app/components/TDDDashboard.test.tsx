import TDDDashboard from '@/app/components/TDDDashboard';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Mock the toast hook
const mockShowToast = jest.fn();
jest.doMock('@/app/components/ui/ToastManager', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

// Mock fetch with proper typing
const mockFetch = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch as any;

// Helper to create mock response
const createMockResponse = (data: any) => ({
  json: jest.fn().mockResolvedValue(data),
} as unknown as Response);

const mockCycles = [
  {
    id: 'cycle-1',
    title: 'User Authentication',
    description: 'Implement user login system',
    phase: 'RED',
    status: 'ACTIVE',
    createdAt: '2023-01-01T00:00:00.000Z',
    tests: [
      {
        id: 'test-1',
        name: 'should validate user credentials',
        status: 'FAILING',
        duration: 150,
        lastRun: '2023-01-01T00:00:00.000Z',
      },
      {
        id: 'test-2',
        name: 'should reject invalid credentials',
        status: 'FAILING',
        duration: 100,
        lastRun: '2023-01-01T00:00:00.000Z',
      },
    ],
    artifacts: [
      {
        id: 'artifact-1',
        type: 'TEST',
        name: 'auth.test.ts',
        phase: 'RED',
        createdAt: '2023-01-01T00:00:00.000Z',
      },
    ],
  },
  {
    id: 'cycle-2',
    title: 'Shopping Cart',
    phase: 'REVIEW',
    status: 'COMPLETED',
    createdAt: '2023-01-01T00:00:00.000Z',
    completedAt: '2023-01-02T00:00:00.000Z',
    tests: [],
    artifacts: [],
  },
];

describe('TDDDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful fetch by default
    mockFetch.mockResolvedValue(
      createMockResponse({
        success: true,
        data: mockCycles,
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render loading state initially', () => {
    render(<TDDDashboard projectId="test-project-id" />);

    expect(screen.getByText('TDD 開發儀表板')).toBeInTheDocument();
    // Should show loading animation
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should render active cycle dashboard', async () => {
    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('User Authentication')).toBeInTheDocument();
    });

    expect(screen.getByText('Implement user login system')).toBeInTheDocument();
    expect(screen.getByText('RED')).toBeInTheDocument();
    expect(screen.getByText('執行 RED 階段')).toBeInTheDocument();
  });

  it('should display tests status correctly', async () => {
    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(
        screen.getByText('should validate user credentials')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('should reject invalid credentials')
    ).toBeInTheDocument();
    expect(screen.getByText('150ms')).toBeInTheDocument();
    expect(screen.getByText('100ms')).toBeInTheDocument();

    // Should show failing test icons (✗)
    const failingIcons = screen.getAllByText('✗');
    expect(failingIcons).toHaveLength(2);
  });

  it('should show phase progress correctly', async () => {
    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('RED 階段')).toBeInTheDocument();
    });

    // Should highlight RED phase in progress
    const progressBars = document.querySelectorAll('.flex-1.h-2.rounded-full');
    expect(progressBars[0]).toHaveClass('bg-red-500');
  });

  it('should display recent artifacts', async () => {
    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('最近生成的檔案')).toBeInTheDocument();
    });

    expect(screen.getByText('auth.test.ts')).toBeInTheDocument();
    expect(screen.getByText('TEST')).toBeInTheDocument();
  });

  it('should execute phase when button clicked', async () => {
    mockFetch
      .mockResolvedValueOnce(
        createMockResponse({
          success: true,
          data: mockCycles,
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          success: true,
          data: { nextPhase: 'GREEN' },
        })
      );

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('執行 RED 階段')).toBeInTheDocument();
    });

    const executeButton = screen.getByText('執行 RED 階段');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/cycles/cycle-1/execute', {
        method: 'PUT',
      });
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      '執行階段成功：GREEN',
      'success'
    );
  });

  it('should handle execution errors', async () => {
    mockFetch
      .mockResolvedValueOnce(
        createMockResponse({
          success: true,
          data: mockCycles,
        })
      )
      .mockResolvedValueOnce(
        createMockResponse({
          success: false,
          error: 'Execution failed',
        })
      );

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('執行 RED 階段')).toBeInTheDocument();
    });

    const executeButton = screen.getByText('執行 RED 階段');
    fireEvent.click(executeButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Execution failed', 'error');
    });
  });

  it('should disable execute button when loading', async () => {
    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('執行 RED 階段')).toBeInTheDocument();
    });

    const executeButton = screen.getByText('執行 RED 階段');
    fireEvent.click(executeButton);

    // Button should be disabled during execution
    expect(executeButton).toBeDisabled();
    expect(screen.getByText('執行中...')).toBeInTheDocument();
  });

  it('should show completed cycles section', async () => {
    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('已完成的週期')).toBeInTheDocument();
    });

    expect(screen.getByText('Shopping Cart')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it('should show empty state when no active cycle', async () => {
    mockFetch.mockResolvedValue(
      createMockResponse({
        success: true,
        data: [mockCycles[1]], // Only completed cycle
      })
    );

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('目前沒有活躍的 TDD 週期')).toBeInTheDocument();
    });

    expect(screen.getByText('開始新的 TDD 週期')).toBeInTheDocument();
  });

  it('should handle fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('無法載入 TDD 週期', 'error');
    });
  });

  it('should handle API error responses', async () => {
    mockFetch.mockResolvedValue(
      createMockResponse({
        success: false,
        error: 'Database connection failed',
      })
    );

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'Database connection failed',
        'error'
      );
    });
  });

  it('should show correct phase icons', async () => {
    const cyclesWithDifferentPhases = [
      { ...mockCycles[0], phase: 'GREEN' },
      { ...mockCycles[0], id: 'cycle-2', phase: 'REFACTOR' },
      { ...mockCycles[0], id: 'cycle-3', phase: 'REVIEW' },
    ];

    mockFetch.mockResolvedValue(
      createMockResponse({
        success: true,
        data: cyclesWithDifferentPhases,
      })
    );

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('GREEN')).toBeInTheDocument();
    });

    // Each phase should have its specific icon (SVG elements)
    const svgElements = document.querySelectorAll('svg');
    expect(svgElements.length).toBeGreaterThan(0);
  });

  it('should show correct test status icons', async () => {
    const cycleWithMixedTests = {
      ...mockCycles[0],
      tests: [
        { ...mockCycles[0].tests[0], status: 'PASSING' },
        { ...mockCycles[0].tests[1], status: 'FAILING' },
        { ...mockCycles[0].tests[0], id: 'test-3', status: 'SKIPPED' },
      ],
    };

    mockFetch.mockResolvedValue(
      createMockResponse({
        success: true,
        data: [cycleWithMixedTests],
      })
    );

    render(<TDDDashboard projectId="test-project-id" />);

    await waitFor(() => {
      expect(screen.getByText('✓')).toBeInTheDocument(); // Passing
      expect(screen.getByText('✗')).toBeInTheDocument(); // Failing
      expect(screen.getByText('⚠')).toBeInTheDocument(); // Skipped
    });
  });

  it('should auto-refresh data every 5 seconds', async () => {
    jest.useFakeTimers();

    render(<TDDDashboard projectId="test-project-id" />);

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Fast-forward 5 seconds
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('should cleanup interval on unmount', () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = render(<TDDDashboard projectId="test-project-id" />);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    jest.useRealTimers();
    clearIntervalSpy.mockRestore();
  });
});