import { Button } from "@/components/ui/button";
import {
  Acolyte,
  DEFAULT_SCHEDULE_SETTINGS,
  IndividualRestriction,
  ScheduleSettings,
} from "@/types/schedule";
import { Save } from "lucide-react";
import { useState } from "react";

interface ScheduleSettingsManagerProps {
  acolytes: Acolyte[];
  settings: ScheduleSettings;
  onSave: (settings: ScheduleSettings) => Promise<void>;
}

const DAY_OPTIONS = [
  { value: "", label: "Qualquer dia" },
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
];

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(value: string[]): string {
  return value.join("\n");
}

function csvToList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToCsv(value?: string[]): string {
  return (value || []).join(", ");
}

function normalizeTimeToken(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return "";

  const colonMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hours = String(Number(colonMatch[1]));
    const minutes = colonMatch[2];
    return minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
  }

  const hMatch = value.match(/^(\d{1,2})h(?:([0-5]\d))?$/);
  if (hMatch) {
    const hours = String(Number(hMatch[1]));
    const minutes = hMatch[2];
    return !minutes || minutes === "00" ? `${hours}h` : `${hours}h${minutes}`;
  }

  return raw.trim();
}

function isValidTimeToken(raw: string): boolean {
  return /^(\d{1,2})(h|:)([0-5]\d)?$/i.test(raw.trim());
}

function couplesToLines(value: [string, string][]): string {
  return value.map(([first, second]) => `${first} | ${second}`).join("\n");
}

function linesToCouples(value: string): [string, string][] {
  return value
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter((parts) => parts[0] && parts[1])
    .map(([first, second]) => [first, second] as [string, string]);
}

function mergeWithDefaults(settings: ScheduleSettings): ScheduleSettings {
  return {
    ...DEFAULT_SCHEDULE_SETTINGS,
    ...settings,
    weekendOnlyNames: settings.weekendOnlyNames || [],
    weakAcolytes: settings.weakAcolytes || [],
    lowCommitmentNames: settings.lowCommitmentNames || [],
    couples: settings.couples || [],
    individualRestrictions: settings.individualRestrictions || [],
    targetChapelLocationIncludes: settings.targetChapelLocationIncludes || [],
  };
}

export default function ScheduleSettingsManager({
  acolytes,
  settings,
  onSave,
}: ScheduleSettingsManagerProps) {
  const [draft, setDraft] = useState<ScheduleSettings>(
    mergeWithDefaults(settings),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = <K extends keyof ScheduleSettings>(
    key: K,
    value: ScheduleSettings[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const updateRestriction = (
    index: number,
    updates: Partial<IndividualRestriction>,
  ) => {
    setDraft((current) => ({
      ...current,
      individualRestrictions: current.individualRestrictions.map(
        (restriction, i) =>
          i === index ? { ...restriction, ...updates } : restriction,
      ),
    }));
  };

  const updateRestrictionAllowedTimes = (index: number, rawValue: string) => {
    const tokens = rawValue
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);

    setDraft((current) => ({
      ...current,
      individualRestrictions: current.individualRestrictions.map(
        (restriction, i) =>
          i === index ? { ...restriction, allowedTimes: tokens } : restriction,
      ),
    }));
  };

  const normalizeRestrictionAllowedTimes = (index: number) => {
    setDraft((current) => ({
      ...current,
      individualRestrictions: current.individualRestrictions.map(
        (restriction, i) =>
          i === index
            ? {
                ...restriction,
                allowedTimes: (restriction.allowedTimes || [])
                  .map((time) => normalizeTimeToken(time))
                  .filter(Boolean),
              }
            : restriction,
      ),
    }));
  };

  const addRestriction = () => {
    setDraft((current) => ({
      ...current,
      individualRestrictions: [
        ...current.individualRestrictions,
        { name: "", allowedTimes: [], blockedLocationIncludes: [] },
      ],
    }));
  };

  const removeRestriction = (index: number) => {
    setDraft((current) => ({
      ...current,
      individualRestrictions: current.individualRestrictions.filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const handleSave = async () => {
    const invalidTimes = draft.individualRestrictions
      .flatMap((restriction) => restriction.allowedTimes || [])
      .filter((time) => !isValidTimeToken(normalizeTimeToken(time)));

    if (invalidTimes.length > 0) {
      setSaveError(
        `Corrija os horários inválidos antes de salvar: ${invalidTimes.join(", ")}`,
      );
      return;
    }

    const normalizedDraft: ScheduleSettings = {
      ...draft,
      individualRestrictions: draft.individualRestrictions.map((restriction) => ({
        ...restriction,
        allowedTimes: (restriction.allowedTimes || [])
          .map((time) => normalizeTimeToken(time))
          .filter(Boolean),
      })),
    };

    setSaveError(null);
    setSaving(true);
    try {
      await onSave(mergeWithDefaults(normalizedDraft));
    } finally {
      setSaving(false);
    }
  };

  const acolyteOptions = acolytes.filter((a) => a.active);

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border/60 bg-muted/20 p-3">
        <h2 className="font-heading font-semibold">Configurações da escala</h2>
        <p className="text-sm text-muted-foreground">
          Estas regras são usadas nas próximas gerações e validações da escala.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <RuleTextarea
          label="Só fins de semana"
          value={listToLines(draft.weekendOnlyNames)}
          onChange={(value) => update("weekendOnlyNames", linesToList(value))}
        />
        <RuleTextarea
          label="Acólitos com dificuldade"
          value={listToLines(draft.weakAcolytes)}
          onChange={(value) => update("weakAcolytes", linesToList(value))}
        />
        <RuleTextarea
          label="Pouca disponibilidade"
          value={listToLines(draft.lowCommitmentNames)}
          onChange={(value) => update("lowCommitmentNames", linesToList(value))}
        />
      </div>

      {saveError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <RuleTextarea
          label="Casais"
          hint="Use uma linha por casal: Nome 1 | Nome 2"
          value={couplesToLines(draft.couples)}
          onChange={(value) => update("couples", linesToCouples(value))}
        />

        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <label className="block text-sm font-medium">
            Peso para pouca disponibilidade
          </label>
          <input
            type="number"
            min={0}
            value={draft.lowCommitmentPenalty}
            onChange={(e) =>
              update("lowCommitmentPenalty", Number(e.target.value) || 0)
            }
            className="w-24 rounded border bg-background px-3 py-2 text-sm"
          />

          <label className="block text-sm font-medium">
            Titular de Agissê/São Sebastião
          </label>
          <select
            value={draft.targetChapelAcolyteName}
            onChange={(e) => update("targetChapelAcolyteName", e.target.value)}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          >
            <option value="">Nenhum</option>
            {acolyteOptions.map((a) => (
              <option key={a.id} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium">
            Termos das capelas fixas
          </label>
          <input
            value={listToCsv(draft.targetChapelLocationIncludes)}
            onChange={(e) =>
              update(
                "targetChapelLocationIncludes",
                csvToList(e.target.value),
              )
            }
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            placeholder="Agissê, Sebastião"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectByName
          label="Preferência em Santa Tereza"
          value={draft.santaTerezaPreferenceName}
          acolytes={acolyteOptions}
          onChange={(value) => update("santaTerezaPreferenceName", value)}
        />
        <SelectByName
          label="Preferência na primeira sexta"
          value={draft.firstFridayPreferenceName}
          acolytes={acolyteOptions}
          onChange={(value) => update("firstFridayPreferenceName", value)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading font-semibold text-sm">
              Regras individuais
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure restrições por acólito sem alterar o código.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRestriction}>
            Adicionar regra
          </Button>
        </div>

        {draft.individualRestrictions.map((restriction, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-border/60 p-3 md:grid-cols-2"
          >
            <select
              value={restriction.name}
              onChange={(e) =>
                updateRestriction(index, { name: e.target.value })
              }
              className="rounded border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione o acólito</option>
              {acolyteOptions.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>

            <select
              value={
                restriction.onlyDayOfWeek === undefined
                  ? ""
                  : String(restriction.onlyDayOfWeek)
              }
              onChange={(e) =>
                updateRestriction(index, {
                  onlyDayOfWeek:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              className="rounded border bg-background px-3 py-2 text-sm"
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={listToCsv(restriction.allowedTimes)}
              onChange={(e) =>
                updateRestrictionAllowedTimes(index, e.target.value)
              }
              onBlur={() => normalizeRestrictionAllowedTimes(index)}
              className={`rounded border bg-background px-3 py-2 text-sm ${
                (restriction.allowedTimes || []).some(
                  (time) => !isValidTimeToken(normalizeTimeToken(time)),
                )
                  ? "border-destructive"
                  : ""
              }`}
              placeholder="Horários permitidos: 7h, 9h30"
            />

            <input
              value={listToCsv(restriction.requiredLocationIncludes)}
              onChange={(e) =>
                updateRestriction(index, {
                  requiredLocationIncludes: csvToList(e.target.value),
                })
              }
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Local obrigatório contém: Agissê"
            />

            <input
              value={listToCsv(restriction.blockedLocationIncludes)}
              onChange={(e) =>
                updateRestriction(index, {
                  blockedLocationIncludes: csvToList(e.target.value),
                })
              }
              className="rounded border bg-background px-3 py-2 text-sm"
              placeholder="Local bloqueado contém: Fátima"
            />

            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!restriction.onlyWeekends}
                  onChange={(e) =>
                    updateRestriction(index, {
                      onlyWeekends: e.target.checked,
                    })
                  }
                />
                Só fins de semana
              </label>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeRestriction(index)}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}

function RuleTextarea({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [localText, setLocalText] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value); // Atualiza a tela exatamente com o que foi digitado
    onChange(e.target.value);     // Envia o texto para o pai processar silenciosamente
  };

  return (
    <label className="block space-y-2 rounded-md border border-border/60 p-3">
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      <textarea
        value={localText}
        onChange={handleChange}
        className="min-h-32 w-full rounded border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}

function SelectByName({
  label,
  value,
  acolytes,
  onChange,
}: {
  label: string;
  value: string;
  acolytes: Acolyte[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 rounded-md border border-border/60 p-3">
      <span className="block text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border bg-background px-3 py-2 text-sm"
      >
        <option value="">Nenhum</option>
        {acolytes.map((a) => (
          <option key={a.id} value={a.name}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
