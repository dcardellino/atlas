"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  create,
  update,
  reorder,
  remove,
  type Area,
} from "@/lib/areas/actions";
import OrphanReassign from "@/components/features/areas/OrphanReassign";
import type { Orphan } from "@/lib/areas/actions";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { AreaFormSchema, fieldErrors } from "@/lib/schemas/forms";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";

/**
 * Areas manager (TASK-027, FR-005). Cards with a drag-handle reorder via
 * @dnd-kit (touch-friendly) and persist `sort_order`; create/edit happen in an
 * overlay. Colour is a `cat-*` design token; icon is a name from a preset list.
 */

export const AREA_COLORS = [
  "cat-rust",
  "cat-forest",
  "cat-navy",
  "cat-gold",
  "cat-maroon",
  "cat-teal",
  "cat-violet",
  "cat-stone",
] as const;

export const AREA_ICONS = [
  "home",
  "activity",
  "wrench",
  "rocket",
  "book",
  "heart",
  "briefcase",
  "leaf",
] as const;

const COLOR_CLASS: Record<string, string> = {
  "cat-rust": "bg-cat-rust",
  "cat-forest": "bg-cat-forest",
  "cat-navy": "bg-cat-navy",
  "cat-gold": "bg-cat-gold",
  "cat-maroon": "bg-cat-maroon",
  "cat-teal": "bg-cat-teal",
  "cat-violet": "bg-cat-violet",
  "cat-stone": "bg-cat-stone",
};

function colorClass(color: string | null): string {
  return (color && COLOR_CLASS[color]) || "bg-on-surface-muted";
}

function SortableCard({ area, onEdit }: { area: Area; onEdit: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: area.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-border py-3"
    >
      <button
        type="button"
        aria-label="Verschieben"
        className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center text-on-surface-muted"
        {...attributes}
        {...listeners}
      >
        ≡
      </button>
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${colorClass(area.color)}`}
        aria-hidden
      />
      <button type="button" onClick={onEdit} className="flex-1 text-left">
        <span className="text-body text-on-surface">{area.name}</span>
        {area.icon && (
          <span className="ml-2 font-mono text-meta uppercase tracking-label text-on-surface-muted">
            {area.icon}
          </span>
        )}
      </button>
    </li>
  );
}

const fieldLabel =
  "font-mono text-label uppercase tracking-label text-on-surface-muted";
const fieldInput =
  "mt-1 w-full rounded-sm border border-border bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-accent";

function AreaEditor({
  area,
  onClose,
}: {
  area: Area | null; // null → create
  onClose: () => void;
}) {
  const [name, setName] = useState(area?.name ?? "");
  const [color, setColor] = useState<string>(area?.color ?? AREA_COLORS[0]);
  const [icon, setIcon] = useState<string>(area?.icon ?? AREA_ICONS[0]);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string> | null>(null);
  const { show: showToast } = useToast();
  useEscapeKey(onClose);

  function save() {
    const errs = fieldErrors(AreaFormSchema, { name });
    setErrors(errs);
    if (errs) return;
    startTransition(async () => {
      if (area) {
        await update(area.id, { name: name.trim(), color, icon });
      } else {
        await create({ name: name.trim(), color, icon });
      }
      onClose();
      showToast(area ? "Gespeichert" : "Bereich angelegt");
    });
  }

  function del() {
    if (!area) return;
    startTransition(async () => {
      await remove(area.id);
      onClose();
      showToast("Bereich gelöscht");
    });
  }

  return (
    <div
      className="bg-on-surface/30 fixed inset-0 z-40 flex items-start justify-center px-4 pt-16"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={area ? "Bereich bearbeiten" : "Neuer Bereich"}
        className="w-full max-w-lg rounded-md border border-border bg-surface-raised p-md"
        onClick={(e) => e.stopPropagation()}
      >
        <p className={fieldLabel}>
          {area ? "Bereich bearbeiten" : "Neuer Bereich"}
        </p>

        <label className="mt-3 block">
          <span className={fieldLabel}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={Boolean(errors?.name)}
            className={fieldInput}
          />
          {errors?.name && (
            <span role="alert" className="mt-1 block text-body-sm text-danger">
              {errors.name}
            </span>
          )}
        </label>

        <div className="mt-4">
          <span className={fieldLabel}>Farbe</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {AREA_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full ${COLOR_CLASS[c]} ${
                  color === c
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-surface-raised"
                    : ""
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className={fieldLabel}>Icon</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {AREA_ICONS.map((i) => (
              <button
                key={i}
                type="button"
                aria-pressed={icon === i}
                onClick={() => setIcon(i)}
                className={`rounded-sm px-3 py-1 font-mono text-meta uppercase tracking-label ${
                  icon === i
                    ? "bg-on-surface text-surface"
                    : "bg-surface text-on-surface-muted"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          {area ? (
            <button
              type="button"
              onClick={del}
              disabled={pending}
              className="h-11 rounded-sm px-2 font-mono text-label uppercase tracking-label text-danger disabled:opacity-60"
            >
              Löschen
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-sm bg-surface px-4 font-mono text-label uppercase tracking-label text-on-surface"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending || !name.trim()}
              className="h-11 rounded-sm bg-on-surface px-5 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-60"
            >
              {pending ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AreaManager({
  areas,
  orphans,
}: {
  areas: Area[];
  orphans: Orphan[];
}) {
  const [items, setItems] = useState(areas);
  const [editing, setEditing] = useState<Area | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  // Adopt server order whenever the *set* of areas changes (create/delete/
  // reassign), using the documented "adjust state during render" pattern. A
  // pure reorder keeps the same ids, so the optimistic order set in onDragEnd is
  // preserved rather than clobbered.
  const idKey = areas
    .map((a) => a.id)
    .sort()
    .join(",");
  const [prevIdKey, setPrevIdKey] = useState(idKey);
  if (idKey !== prevIdKey) {
    setPrevIdKey(idKey);
    setItems(areas);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((a) => a.id === active.id);
    const newIndex = items.findIndex((a) => a.id === over.id);
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // optimistic
    startTransition(() => reorder(next.map((a) => a.id)));
  }

  return (
    <section>
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-label uppercase tracking-label text-on-surface-muted">
            Lebensbereiche
          </p>
          <h1 className="mt-1 font-serif text-display text-on-surface">
            Areas
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-11 rounded-sm bg-on-surface px-4 font-mono text-label uppercase tracking-label text-surface transition-colors hover:bg-accent hover:text-on-accent"
        >
          Neu
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Noch keine Bereiche."
          hint="Lege deinen ersten Lebensbereich an."
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="mt-6">
              {items.map((a) => (
                <SortableCard
                  key={a.id}
                  area={a}
                  onEdit={() => setEditing(a)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <OrphanReassign orphans={orphans} areas={items} />

      {(editing || creating) && (
        <AreaEditor
          area={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}
