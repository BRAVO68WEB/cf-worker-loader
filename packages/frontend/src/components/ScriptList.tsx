import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormScriptRef } from "@orcratration/shared";

const HOOK_EVENTS = ["onLoad", "onValidate", "onSubmit", "onPageChange"] as const;

type ScriptOption = { _id: string; name: string };

function SortableScriptRow({
  item,
  index,
  scriptName,
  onEventChange,
  onRemove,
}: {
  item: FormScriptRef;
  index: number;
  scriptName: string;
  onEventChange: (event: string) => void;
  onRemove: () => void;
}) {
  const id = `script-${index}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`script-list-row ${isDragging ? "dragging" : ""}`}
    >
      <span className="script-list-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
        ⋮⋮
      </span>
      <span className="script-list-name">{scriptName}</span>
      <select
        className="script-list-event"
        value={item.event}
        onChange={(e) => onEventChange(e.target.value)}
      >
        {HOOK_EVENTS.map((ev) => (
          <option key={ev} value={ev}>
            {ev}
          </option>
        ))}
      </select>
      <button type="button" className="script-list-remove" onClick={onRemove} aria-label="Remove script">
        Remove
      </button>
    </div>
  );
}

export default function ScriptList({
  scripts,
  onScriptsChange,
  availableScripts,
}: {
  scripts: FormScriptRef[];
  onScriptsChange: (scripts: FormScriptRef[]) => void;
  availableScripts: ScriptOption[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableIds = scripts.map((_, i) => `script-${i}`);
  const attachedIds = new Set(scripts.map((s) => s.scriptId));
  const canAdd = availableScripts.filter((s) => !attachedIds.has(s._id));

  function getScriptName(scriptId: string): string {
    const s = availableScripts.find((x) => x._id === scriptId);
    return s?.name ?? scriptId;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sortableIds.indexOf(String(active.id));
    const to = sortableIds.indexOf(String(over.id));
    if (from !== -1 && to !== -1) {
      const reordered = arrayMove(scripts, from, to);
      const withOrder = reordered.map((s, i) => ({ ...s, order: i }));
      onScriptsChange(withOrder);
    }
  }

  function addScript(scriptId: string) {
    const ref: FormScriptRef = {
      scriptId,
      event: "onLoad",
      order: scripts.length,
    };
    onScriptsChange([...scripts, ref]);
  }

  function updateEvent(index: number, event: string) {
    const next = scripts.map((s, i) => (i === index ? { ...s, event } : s));
    onScriptsChange(next);
  }

  function removeScript(index: number) {
    const next = scripts.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
    onScriptsChange(next);
  }

  return (
    <div className="script-list">
      {canAdd.length > 0 && (
        <div className="script-list-add">
          <label htmlFor="script-list-select">Add script: </label>
          <select
            id="script-list-select"
            className="script-list-select"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                addScript(v);
                e.target.value = "";
              }
            }}
          >
            <option value="">— Choose script —</option>
            {canAdd.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scripts.length === 0 ? (
        <p className="script-list-empty">No scripts attached. Add a script from the dropdown above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="script-list-rows">
              {scripts.map((ref, index) => (
                <SortableScriptRow
                  key={`${ref.scriptId}-${index}`}
                  item={ref}
                  index={index}
                  scriptName={getScriptName(ref.scriptId)}
                  onEventChange={(event) => updateEvent(index, event)}
                  onRemove={() => removeScript(index)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
