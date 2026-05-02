import type React from 'react';

type KanbanEmptyLaneProps = {
  className?: string;
  children?: React.ReactNode;
};

export function KanbanEmptyLane({ className, children }: KanbanEmptyLaneProps) {
  return (
    <div
      className={className ? `kanban-empty-lane ${className}` : 'kanban-empty-lane'}
      data-kanban-empty-lane="true"
      aria-hidden={children ? undefined : 'true'}
    >
      {children}
    </div>
  );
}
