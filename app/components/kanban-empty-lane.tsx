type KanbanEmptyLaneProps = {
  className?: string;
};

export function KanbanEmptyLane({ className }: KanbanEmptyLaneProps) {
  return (
    <div
      className={className ? `kanban-empty-lane ${className}` : 'kanban-empty-lane'}
      data-kanban-empty-lane="true"
      aria-hidden="true"
    />
  );
}
