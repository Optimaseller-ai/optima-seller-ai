"use client";

import * as React from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, StickyNote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { createProspect, updateProspectNotes, updateProspectStatus } from "@/app/(app)/app/crm/actions";

export type ProspectStatus = "new" | "interested" | "won" | "lost";

export type Prospect = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  status: ProspectStatus;
  created_at: string;
  updated_at: string;
};

const COLUMNS: { id: ProspectStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "interested", label: "Interested" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export function CrmBoard({ initial }: { initial: Prospect[] }) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<Prospect[]>(initial);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = React.useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.id] = items.filter((p) => p.status === col.id);
      return acc;
    }, {} as Record<ProspectStatus, Prospect[]>);
  }, [items]);

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItem = items.find((p) => p.id === activeId);
    if (!activeItem) return;

    // Dropping on a column
    if (COLUMNS.some((c) => c.id === (overId as ProspectStatus))) {
      const nextStatus = overId as ProspectStatus;
      if (nextStatus === activeItem.status) return;
      setItems((prev) =>
        prev.map((p) => (p.id === activeId ? { ...p, status: nextStatus } : p)),
      );
      try {
        await updateProspectStatus({ id: activeId, status: nextStatus });
      } catch {
        toast({ title: "Mode démo", description: "Activez Supabase pour sauvegarder les mouvements." });
      }
      return;
    }

    // Dropping on another card: reorder inside that status
    const overItem = items.find((p) => p.id === overId);
    if (!overItem) return;

    if (activeItem.status !== overItem.status) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === activeId ? { ...p, status: overItem.status } : p,
        ),
      );
      try {
        await updateProspectStatus({ id: activeId, status: overItem.status });
      } catch {
        toast({ title: "Mode démo", description: "Activez Supabase pour sauvegarder les mouvements." });
      }
      return;
    }

    const list = grouped[activeItem.status];
    const oldIndex = list.findIndex((p) => p.id === activeId);
    const newIndex = list.findIndex((p) => p.id === overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const reordered = arrayMove(list, oldIndex, newIndex);
    setItems((prev) => {
      const others = prev.filter((p) => p.status !== activeItem.status);
      return [...others, ...reordered];
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM mini pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajoutez un prospect, deplacez les cartes, gardez des notes.
          </p>
        </div>
        <AddProspect onAdd={(p) => setItems((prev) => [p, ...prev])} />
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <Column key={col.id} id={col.id} title={col.label} items={grouped[col.id]} onNotesSaved={(id, notes) => {
              setItems((prev) => prev.map((p) => (p.id === id ? { ...p, notes } : p)));
            }} />
          ))}
        </div>
      </DndContext>

      <Card>
        <CardHeader>
          <CardTitle>Astuce</CardTitle>
          <CardDescription>
            Utilisez l&apos;onglet IA pour relancer un prospect et collez le message dans WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Le pipeline devient puissant quand vous combinez les notes (objections, budget, ville) et les scripts de closing.
        </CardContent>
      </Card>
    </div>
  );
}

function Column({
  id,
  title,
  items,
  onNotesSaved,
}: {
  id: ProspectStatus;
  title: string;
  items: Prospect[];
  onNotesSaved: (id: string, notes: string | null) => void;
}) {
  return (
    <Card className="bg-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{items.length} prospect(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <SortableContext items={items.map((p) => p.id)}>
          <DroppableColumn id={id}>
            {items.map((p) => (
              <ProspectCard key={p.id} prospect={p} onNotesSaved={onNotesSaved} />
            ))}
            {items.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed bg-background/40 p-3 text-sm text-muted-foreground">
                Deposez une carte ici.
              </div>
            ) : null}
          </DroppableColumn>
        </SortableContext>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[48px] space-y-2 rounded-[var(--radius)]",
        isOver && "ring-2 ring-primary/20",
      )}
    >
      {children}
    </div>
  );
}

function ProspectCard({
  prospect,
  onNotesSaved,
}: {
  prospect: Prospect;
  onNotesSaved: (id: string, notes: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prospect.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-[var(--radius)] border bg-background p-3 shadow-sm",
        isDragging && "opacity-70",
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{prospect.name}</div>
          {prospect.phone ? (
            <div className="truncate text-xs text-muted-foreground">{prospect.phone}</div>
          ) : null}
        </div>
        <NotesButton prospect={prospect} onSaved={onNotesSaved} />
      </div>
      {prospect.notes ? (
        <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {prospect.notes}
        </div>
      ) : null}
    </div>
  );
}

function NotesButton({
  prospect,
  onSaved,
}: {
  prospect: Prospect;
  onSaved: (id: string, notes: string | null) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState(prospect.notes ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateProspectNotes({ id: prospect.id, notes });
      onSaved(prospect.id, notes || null);
      setOpen(false);
      toast({ title: "Notes mises a jour" });
    } catch {
      onSaved(prospect.id, notes || null);
      setOpen(false);
      toast({ title: "Mode démo", description: "Notes sauvegardées localement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="secondary" aria-label="Notes">
          <StickyNote className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
          <DialogDescription>Objections, budget, ville, preferences...</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`notes-${prospect.id}`}>Notes</Label>
          <Textarea id={`notes-${prospect.id}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Button size="lg" className="w-full" onClick={save} disabled={saving}>
            {saving ? "Sauvegarde..." : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddProspect({ onAdd }: { onAdd: (p: Prospect) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (name.trim().length < 2) {
      toast({ title: "Nom requis", description: "Ajoutez au moins 2 caracteres." });
      return;
    }

    setSaving(true);
    try {
      const p = await createProspect({ name, phone, notes });
      onAdd(p as Prospect);
      setOpen(false);
      setName("");
      setPhone("");
      setNotes("");
      toast({ title: "Prospect ajoute" });
    } catch {
      const demo: Prospect = {
        id: `demo-${crypto.randomUUID()}`,
        user_id: "demo",
        name,
        phone: phone || null,
        notes: notes || null,
        status: "new",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      onAdd(demo);
      setOpen(false);
      toast({ title: "Mode démo", description: "Prospect ajouté localement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="h-11">
          <Plus className="size-4" /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau prospect</DialogTitle>
          <DialogDescription>Ajoutez un prospect pour suivre le pipeline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nom</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Client robe - Nadine" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-phone">Telephone (optionnel)</Label>
            <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 ..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-notes">Notes (optionnel)</Label>
            <Textarea id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ex: budget, ville, objection..." />
          </div>
          <Button size="lg" className="w-full" onClick={submit} disabled={saving}>
            {saving ? "Ajout..." : "Ajouter le prospect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
