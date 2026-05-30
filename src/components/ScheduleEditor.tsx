import { ScheduleData, ScheduleEntry, Acolyte } from "@/types/schedule";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

interface ScheduleEditorProps {
  data: ScheduleData;
  acolytes: Acolyte[];
  onChange: (data: ScheduleData) => void;
}

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SPECIAL_SECTION_TITLE = "Escalas Especiais";
const COMMON_ROLES = [
  "Cerimoniário",
  "Turiferário",
  "Naveteiro",
  "Ceroferário",
  "Cruciferário",
  "Librífero",
  "Mitra",
  "Báculo",
];

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
  const [specialDate, setSpecialDate] = useState("");
  const [specialLocation, setSpecialLocation] = useState("");
  const [specialTime, setSpecialTime] = useState("");
  const [specialAcolytes, setSpecialAcolytes] = useState<string[]>([]);

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
      acolyteRoles: Object.fromEntries(
        Object.entries(entry.acolyteRoles || {}).filter(
          ([id]) => id !== acolyteId,
        ),
      ),
    });
  };

  const updateEntrySolemnity = (
    sectionIdx: number,
    entryIdx: number,
    updates: Pick<ScheduleEntry, "isSolemn" | "solemnityName">,
  ) => {
    const entry = data.sections[sectionIdx].entries[entryIdx];
    updateEntry(sectionIdx, entryIdx, {
      ...entry,
      ...updates,
      solemnityName:
        updates.isSolemn === false ? "" : updates.solemnityName ?? entry.solemnityName,
      acolyteRoles: updates.isSolemn === false ? {} : entry.acolyteRoles,
    });
  };

  const updateAcolyteRole = (
    sectionIdx: number,
    entryIdx: number,
    acolyteId: string,
    role: string,
  ) => {
    const entry = data.sections[sectionIdx].entries[entryIdx];
    const nextRoles = { ...(entry.acolyteRoles || {}) };

    if (role.trim()) {
      nextRoles[acolyteId] = role.trim();
    } else {
      delete nextRoles[acolyteId];
    }

    updateEntry(sectionIdx, entryIdx, {
      ...entry,
      acolyteRoles: nextRoles,
    });
  };

  const addSpecialAcolyte = (acolyteId: string) => {
    if (specialAcolytes.includes(acolyteId)) return;
    setSpecialAcolytes([...specialAcolytes, acolyteId]);
  };

  const removeSpecialAcolyte = (acolyteId: string) => {
    setSpecialAcolytes(specialAcolytes.filter((id) => id !== acolyteId));
  };

  const addSpecialEntry = () => {
    if (!specialDate || !specialLocation.trim() || !specialTime.trim()) return;

    const newEntry: ScheduleEntry = {
      date: specialDate,
      dayOfWeek: new Date(`${specialDate}T12:00:00`).getDay(),
      location: specialLocation.trim(),
      time: specialTime.trim(),
      acolytes: specialAcolytes,
    };

    const specialSectionIndex = data.sections.findIndex(
      (section) => section.title === SPECIAL_SECTION_TITLE,
    );

    const newData = {
      ...data,
      sections:
        specialSectionIndex >= 0
          ? data.sections.map((section, index) =>
              index === specialSectionIndex
                ? { ...section, entries: [...section.entries, newEntry] }
                : section,
            )
          : [
              ...data.sections,
              { title: SPECIAL_SECTION_TITLE, entries: [newEntry] },
            ],
    };

    onChange(newData);
    setSpecialDate("");
    setSpecialLocation("");
    setSpecialTime("");
    setSpecialAcolytes([]);
  };

  const removeEntry = (sectionIdx: number, entryIdx: number) => {
    const newData = {
      ...data,
      sections: data.sections
        .map((section, index) => {
          if (index !== sectionIdx) return section;
          return {
            ...section,
            entries: section.entries.filter((_, i) => i !== entryIdx),
          };
        })
        .filter(
          (section) =>
            section.title !== SPECIAL_SECTION_TITLE || section.entries.length > 0,
        ),
    };

    onChange(newData);
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

    const hasSolemnity = (entry.solemnityName || "")
      .toLowerCase()
      .includes(searchLower);

    const hasRole = Object.values(entry.acolyteRoles || {}).some((role) =>
      role.toLowerCase().includes(searchLower),
    );

    return hasName || hasDate || hasSolemnity || hasRole;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 border border-border/60 rounded-md p-3 bg-muted/20">
        <div>
          <h4 className="font-heading font-semibold text-sm">
            Escala especial
          </h4>
          <p className="text-xs text-muted-foreground">
            Adicione missas ou celebrações fora da escala padrão.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-[140px_1fr_120px]">
          <input
            type="date"
            value={specialDate}
            onChange={(e) => setSpecialDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-background"
          />
          <input
            type="text"
            placeholder="Local / capela"
            value={specialLocation}
            onChange={(e) => setSpecialLocation(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-background"
          />
          <input
            type="text"
            placeholder="Horário"
            value={specialTime}
            onChange={(e) => setSpecialTime(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select onValueChange={addSpecialAcolyte}>
            <SelectTrigger className="h-8 text-xs w-56">
              <SelectValue placeholder="+ Adicionar acólito" />
            </SelectTrigger>
            <SelectContent>
              {activeAcolytes
                .filter((a) => !specialAcolytes.includes(a.id))
                .map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {specialAcolytes.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 bg-secondary px-2 py-1 rounded text-xs"
            >
              {getName(id)}
              <button
                type="button"
                onClick={() => removeSpecialAcolyte(id)}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={addSpecialEntry}
          disabled={!specialDate || !specialLocation.trim() || !specialTime.trim()}
          className="w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar escala especial
        </Button>
      </div>

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
                    {section.title === SPECIAL_SECTION_TITLE && (
                      <button
                        type="button"
                        onClick={() => removeEntry(sectionIdx, index)}
                        className="ml-auto inline-flex items-center gap-1 text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 rounded border border-border/50 bg-background/70 p-2 mb-2">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={!!entry.isSolemn}
                        onChange={(e) =>
                          updateEntrySolemnity(sectionIdx, index, {
                            isSolemn: e.target.checked,
                          })
                        }
                        className="h-4 w-4"
                      />
                      Missa solene
                    </label>

                    {entry.isSolemn && (
                      <input
                        type="text"
                        placeholder="Solenidade (ex: Corpus Christi)"
                        value={entry.solemnityName || ""}
                        onChange={(e) =>
                          updateEntrySolemnity(sectionIdx, index, {
                            solemnityName: e.target.value,
                          })
                        }
                        className="border rounded px-2 py-1 text-xs w-full bg-background"
                      />
                    )}
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

                  {entry.isSolemn && entry.acolytes.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {entry.acolytes.map((id) => (
                        <div
                          key={id}
                          className="grid gap-1 md:grid-cols-[160px_1fr] items-center"
                        >
                          <span className="text-xs font-medium">
                            {getName(id)}
                          </span>
                          <input
                            type="text"
                            list={`roles-${sectionIdx}-${index}-${id}`}
                            placeholder="Função na missa"
                            value={entry.acolyteRoles?.[id] || ""}
                            onChange={(e) =>
                              updateAcolyteRole(
                                sectionIdx,
                                index,
                                id,
                                e.target.value,
                              )
                            }
                            className="border rounded px-2 py-1 text-xs bg-background"
                          />
                          <datalist id={`roles-${sectionIdx}-${index}-${id}`}>
                            {COMMON_ROLES.map((role) => (
                              <option key={role} value={role} />
                            ))}
                          </datalist>
                        </div>
                      ))}
                    </div>
                  )}

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
