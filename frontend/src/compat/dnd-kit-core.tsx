import type { ReactNode } from "react";
export function DndContext({ children }: { children: ReactNode }) { return <>{children}</>; }
export function DragOverlay({ children }: { children?: ReactNode }) { return <>{children}</>; }
export const closestCenter = () => null;
export function useDraggable() { return { attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }; }
export function useDroppable() { return { isOver: false, setNodeRef: () => {} }; }
export function useDndContext() { return {}; }
