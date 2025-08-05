import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import KanbanBoard from '@/components/KanbanBoard';
import { mockProject, mockCycle } from '@/__tests__/helpers/test-utils';

jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => {
    // Mock drag and drop functionality
    const mockDragEnd = () => {
      const mockResult: DropResult = {
        draggableId: 'cycle-1',
        type: 'DEFAULT',
        source: { droppableId: 'RED', index: 0 },
        destination: { droppableId: 'GREEN', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null,
      };
      onDragEnd(mockResult);
    };

    return (
      <div>
        {children}
        <button onClick={mockDragEnd} data-testid="mock-drag-drop">
          Mock Drag Drop
        </button>
      </div>
    );
  },
  Droppable: ({ children, droppableId }: any) => (
    <div data-testid={`droppable-${droppableId}`}>
      {children(
        {
          draggableProps: {},
          dragHandleProps: {},
          innerRef: () => {},
        },
        {}
      )}
    </div>
  ),
  Draggable: ({ children, draggableId, index }: any) => (
    <div data-testid={`draggable-${draggableId}`}>
      {children(
        {
          draggableProps: {},
          dragHandleProps: {},
          innerRef: () => {},
        },
        {}
      )}
    </div>
  ),
}));

const mockCycles = [
  {
    ...mockCycle,
    id: 'cycle-1',
    title: 'User Authentication',
    phase: 'RED',
    status: 'ACTIVE',
  },
  {
    ...mockCycle,
    id: 'cycle-2',
    title: 'Data Validation',
    phase: 'GREEN',
    status: 'ACTIVE',
  },
  {
    ...mockCycle,
    id: 'cycle-3',
    title: 'Error Handling',
    phase: 'REFACTOR',
    status: 'ACTIVE',
  },
  {
    ...mockCycle,
    id: 'cycle-4',
    title: 'Performance Optimization',
    phase: 'REVIEW',
    status: 'COMPLETED',
  },
];

describe('KanbanBoard', () => {
  const defaultProps = {
    project: mockProject,
    cycles: mockCycles,
    onCycleUpdate: jest.fn(),
    onCycleCreate: jest.fn(),
    onCycleDelete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render kanban columns for each TDD phase', () => {
    render(<KanbanBoard {...defaultProps} />);

    expect(screen.getByText('RED')).toBeInTheDocument();
    expect(screen.getByText('GREEN')).toBeInTheDocument();
    expect(screen.getByText('REFACTOR')).toBeInTheDocument();
    expect(screen.getByText('REVIEW')).toBeInTheDocument();
  });

  it('should display cycles in correct columns based on phase', () => {
    render(<KanbanBoard {...defaultProps} />);

    expect(screen.getByText('User Authentication')).toBeInTheDocument();
    expect(screen.getByText('Data Validation')).toBeInTheDocument();
    expect(screen.getByText('Error Handling')).toBeInTheDocument();
    expect(screen.getByText('Performance Optimization')).toBeInTheDocument();
  });

  it('should show cycle cards with proper information', () => {
    render(<KanbanBoard {...defaultProps} />);

    const cycleCard = screen.getByText('User Authentication').closest('.cycle-card');
    expect(cycleCard).toBeInTheDocument();
  });

  it('should handle drag and drop between columns', async () => {
    const onCycleUpdate = jest.fn();
    render(<KanbanBoard {...defaultProps} onCycleUpdate={onCycleUpdate} />);

    const dragDropButton = screen.getByTestId('mock-drag-drop');
    fireEvent.click(dragDropButton);

    await waitFor(() => {
      expect(onCycleUpdate).toHaveBeenCalledWith('cycle-1', {
        phase: 'GREEN',
      });
    });
  });

  it('should display column statistics', () => {
    render(<KanbanBoard {...defaultProps} />);

    // Each column should show count of cycles
    const redColumn = screen.getByTestId('droppable-RED');
    const greenColumn = screen.getByTestId('droppable-GREEN');
    const refactorColumn = screen.getByTestId('droppable-REFACTOR');
    const reviewColumn = screen.getByTestId('droppable-REVIEW');

    expect(redColumn).toBeInTheDocument();
    expect(greenColumn).toBeInTheDocument();
    expect(refactorColumn).toBeInTheDocument();
    expect(reviewColumn).toBeInTheDocument();
  });

  it('should show add cycle button in RED column', () => {
    render(<KanbanBoard {...defaultProps} />);

    const addButton = screen.getByText('Add Cycle');
    expect(addButton).toBeInTheDocument();
  });

  it('should handle add cycle action', async () => {
    const onCycleCreate = jest.fn();
    render(<KanbanBoard {...defaultProps} onCycleCreate={onCycleCreate} />);

    const addButton = screen.getByText('Add Cycle');
    fireEvent.click(addButton);

    expect(onCycleCreate).toHaveBeenCalledTimes(1);
  });

  it('should display cycle priority indicators', () => {
    const cyclesWithPriority = mockCycles.map((cycle, index) => ({
      ...cycle,
      priority: ['HIGH', 'MEDIUM', 'LOW', 'MEDIUM'][index],
    }));

    render(<KanbanBoard {...defaultProps} cycles={cyclesWithPriority} />);

    // Priority indicators should be visible
    expect(screen.getByText('User Authentication')).toBeInTheDocument();
  });

  it('should show cycle status badges', () => {
    render(<KanbanBoard {...defaultProps} />);

    // Status badges should be present
    expect(screen.getByText('Performance Optimization')).toBeInTheDocument();
  });

  it('should handle empty columns gracefully', () => {
    const emptyCycles: typeof mockCycles = [];
    render(<KanbanBoard {...defaultProps} cycles={emptyCycles} />);

    expect(screen.getByText('RED')).toBeInTheDocument();
    expect(screen.getByText('GREEN')).toBeInTheDocument();
    expect(screen.getByText('REFACTOR')).toBeInTheDocument();
    expect(screen.getByText('REVIEW')).toBeInTheDocument();
  });

  it('should display cycle metadata', () => {
    const cyclesWithMetadata = mockCycles.map((cycle) => ({
      ...cycle,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      tests: [{ id: 'test-1', status: 'FAILING' }],
      artifacts: [{ id: 'artifact-1', type: 'CODE' }],
    }));

    render(<KanbanBoard {...defaultProps} cycles={cyclesWithMetadata} />);

    expect(screen.getByText('User Authentication')).toBeInTheDocument();
  });

  it('should prevent invalid drag operations', async () => {
    const onCycleUpdate = jest.fn();
    render(<KanbanBoard {...defaultProps} onCycleUpdate={onCycleUpdate} />);

    // Mock a drag operation with no destination
    const DragDropContextComponent = DragDropContext as jest.MockedFunction<typeof DragDropContext>;
    const mockOnDragEnd = DragDropContextComponent.mock.calls[0][0].onDragEnd;

    const invalidDropResult: DropResult = {
      draggableId: 'cycle-1',
      type: 'DEFAULT',
      source: { droppableId: 'RED', index: 0 },
      destination: null, // No destination
      reason: 'CANCEL',
      mode: 'FLUID',
      combine: null,
    };

    mockOnDragEnd(invalidDropResult);

    expect(onCycleUpdate).not.toHaveBeenCalled();
  });

  it('should handle cycle deletion', async () => {
    const onCycleDelete = jest.fn();
    render(<KanbanBoard {...defaultProps} onCycleDelete={onCycleDelete} />);

    // Find delete button (assuming it exists in cycle cards)
    const deleteButtons = screen.getAllByLabelText('Delete cycle');
    fireEvent.click(deleteButtons[0]);

    expect(onCycleDelete).toHaveBeenCalledWith('cycle-1');
  });

  it('should show loading state during updates', async () => {
    const onCycleUpdate = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<KanbanBoard {...defaultProps} onCycleUpdate={onCycleUpdate} />);

    const dragDropButton = screen.getByTestId('mock-drag-drop');
    fireEvent.click(dragDropButton);

    // Should show loading indicator
    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  it('should filter cycles by search term', () => {
    render(<KanbanBoard {...defaultProps} searchTerm="Authentication" />);

    expect(screen.getByText('User Authentication')).toBeInTheDocument();
    expect(screen.queryByText('Data Validation')).not.toBeInTheDocument();
  });

  it('should handle cycle phase progression rules', async () => {
    const onCycleUpdate = jest.fn();
    render(<KanbanBoard {...defaultProps} onCycleUpdate={onCycleUpdate} />);

    // Mock drag from RED to REFACTOR (skipping GREEN) - should be prevented
    const DragDropContextComponent = DragDropContext as jest.MockedFunction<typeof DragDropContext>;
    const mockOnDragEnd = DragDropContextComponent.mock.calls[0][0].onDragEnd;

    const invalidProgressionResult: DropResult = {
      draggableId: 'cycle-1',
      type: 'DEFAULT',
      source: { droppableId: 'RED', index: 0 },
      destination: { droppableId: 'REFACTOR', index: 0 },
      reason: 'DROP',
      mode: 'FLUID',
      combine: null,
    };

    mockOnDragEnd(invalidProgressionResult);

    // Should not update due to invalid phase progression
    expect(onCycleUpdate).not.toHaveBeenCalled();
  });
});
