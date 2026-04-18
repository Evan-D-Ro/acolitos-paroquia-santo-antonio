import { ScheduleData, ScheduleEntry, Acolyte } from "@/types/schedule";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

interface ScheduleEditorProps {
  data: ScheduleData;
  acolytes: Acolyte[];
  onChange: (data: ScheduleData) => void;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatDateBR(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export default function ScheduleEditor({
  data,
  acolytes,
  onChange,
}: ScheduleEditorProps) {
  const activeAcolytes = acolytes.filter((a) => a.active);

  const [search, setSearch] = useState("");

  const updateEntry = (
    sectionIdx: number,
    entryIdx: number,
    newEntry: ScheduleEntry,
  ) => {
    const newData = {
      ...data,
      sections: data.sections.map((s, si) => {
        if (si !== sectionIdx) return s;
        return {
          ...s,
          entries: s.entries.map((e, ei) => (ei === entryIdx ? newEntry : e)),
        };
      }),
    };
    onChange(newData);
  };

  const addAcolyteToEntry = (
    sectionIdx: number,
    entryIdx: number,
    acolyteId: string,
  ) => {
    const entry = data.sections[sectionIdx].entries[entryIdx];
    if (entry.acolytes.includes(acolyteId)) return;
    updateEntry(sectionIdx, entryIdx, {
      ...entry,
      acolytes: [...entry.acolytes, acolyteId],
    });
  };

  const removeAcolyteFromEntry = (
    sectionIdx: number,
    entryIdx: number,
    acolyteId: string,
  ) => {
    const entry = data.sections[sectionIdx].entries[entryIdx];
    updateEntry(sectionIdx, entryIdx, {
      ...entry,
      acolytes: entry.acolytes.filter((id) => id !== acolyteId),
    });
  };

  const getName = (id: string) => acolytes.find((a) => a.id === id)?.name || id;

  function matchesSearch(entry: ScheduleEntry) {
    if (!search.trim()) return true;

    const searchLower = search.toLowerCase();

    // 🔍 Buscar por nome
    const hasName = entry.acolytes.some((id) =>
      getName(id).toLowerCase().includes(searchLower),
    );

    // 🔍 Buscar por data (DD/MM)
    const formattedDate = formatDateBR(entry.date);
    const hasDate = formattedDate.includes(searchLower);

    return hasName || hasDate;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar por nome ou data (ex: João ou 12/04)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1 text-sm w-full max-w-sm"
        />
      </div>

      {data.sections.map((section, sectionIdx) => {
        const filteredEntries = section.entries
          .map((entry, index) => ({ entry, index }))
          .filter(({ entry }) => matchesSearch(entry));
        if (filteredEntries.length === 0) return null;

        return (
          <div key={section.title} className="space-y-2">
            <h4 className="font-heading font-semibold text-sm border-b border-accent/30 pb-1">
              {section.title}
            </h4>

            <div className="space-y-2">
              {filteredEntries.map(({ entry, index }) => (
                <div
                  key={`${entry.date}-${entry.location}-${entry.time}`}
                  className="p-2 rounded border border-border/50 bg-card/50 text-sm"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                    <span className="font-medium text-foreground">
                      {formatDateBR(entry.date)} ({DAY_NAMES[entry.dayOfWeek]})
                    </span>
                    <span>•</span>
                    <span>{entry.location}</span>
                    <span className="text-accent font-semibold">
                      {entry.time}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {entry.acolytes.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 rounded text-xs"
                      >
                        {getName(id)}
                        <button
                          onClick={() =>
                            removeAcolyteFromEntry(sectionIdx, index, id)
                          }
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <Select
                    onValueChange={(v) =>
                      addAcolyteToEntry(sectionIdx, index, v)
                    }
                  >
                    <SelectTrigger className="h-7 text-xs w-48">
                      <SelectValue placeholder="+ Adicionar acólito" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeAcolytes
                        .filter((a) => !entry.acolytes.includes(a.id))
                        .map((a) => (
                          <SelectItem
                            key={a.id}
                            value={a.id}
                            className="text-xs"
                          >
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
