'use client';

import { useRouter } from 'next/navigation';
import { SprintPlanning } from './SprintPlanning';

interface SprintPlanningWrapperProps {
  sprint: any;
  projectId: string;
}

export function SprintPlanningWrapper({ sprint, projectId }: SprintPlanningWrapperProps) {
  const router = useRouter();

  const handleUpdate = () => {
    router.refresh();
  };

  return (
    <SprintPlanning
      projectId={projectId}
      sprint={sprint}
      onUpdate={handleUpdate}
    />
  );
}