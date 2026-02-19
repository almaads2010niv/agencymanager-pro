import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Settings, RotateCcw, X } from 'lucide-react';

interface SectionDef {
  id: string;
  label: string;
}

interface SortableItemProps {
  id: string;
  label: string;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, label }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-[#0B1121] border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 touch-none"
      >
        <GripVertical size={14} />
      </button>
      <span>{label}</span>
    </div>
  );
};

interface SectionReorderProps {
  sections: SectionDef[];
  order: string[];
  onReorder: (newOrder: string[]) => void;
  onReset: () => void;
}

const SectionReorder: React.FC<SectionReorderProps> = ({ sections, order, onReorder, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      onReorder(arrayMove(order, oldIndex, newIndex));
    }
  };

  const orderedSections = order
    .map(id => sections.find(s => s.id === id))
    .filter(Boolean) as SectionDef[];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2"
        title="סדר מחדש את הבלוקים"
      >
        <Settings size={12} />
        <span>סדר בלוקים</span>
      </button>
    );
  }

  return (
    <div className="bg-[#151e32] border border-white/10 rounded-xl p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">סדר בלוקים — גרור לסידור מחדש</h3>
        <div className="flex items-center gap-2">
          <button onClick={onReset} className="text-xs text-gray-500 hover:text-primary flex items-center gap-1" title="איפוס לברירת מחדל">
            <RotateCcw size={12} /> איפוס
          </button>
          <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-300">
            <X size={14} />
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {orderedSections.map(section => (
              <SortableItem key={section.id} id={section.id} label={section.label} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SectionReorder;
