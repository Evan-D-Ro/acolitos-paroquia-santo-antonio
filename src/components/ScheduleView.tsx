import { ScheduleData, MONTH_NAMES, Acolyte } from "@/types/schedule";
import { useState } from "react";
import { useLocation } from "react-router-dom";

interface ScheduleViewProps {
  data: ScheduleData;
  month: number;
  year: number;
  acolytes: Acolyte[];
}

// Mapeamento dos dias da semana
const DAY_NAMES = [
  "DOMINGO",
  "SEGUNDA-FEIRA",
  "TERÇA-FEIRA",
  "QUARTA-FEIRA",
  "QUINTA-FEIRA",
  "SEXTA-FEIRA",
  "SÁBADO",
];

// Helper para formatar a data (DD/MM)
function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

// Helper robusto para formatar o horário (ex: "07:00" -> "7h", "19:30" -> "19h30")
function formatTimeSafe(time: string): string {
  if (!time) return "";

  // Se o horário tiver ":", tentamos formatar para o padrão "7h30"
  if (time.includes(":")) {
    const [h, m] = time.split(":");
    const hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);

    if (isNaN(hours)) return time; // Se falhar, retorna o original
    if (isNaN(minutes) || minutes === 0) return `${hours}h`; // "07:00" -> "7h"

    return `${hours}h${minutes.toString().padStart(2, "0")}`; // "07:30" -> "7h30"
  }

  // Se já vier formatado do banco ou for um texto livre, mantém como está
  return time;
}

// Helper para gerar o display do Local e Horário
function formatLocationAndTime(location: string, time: string): string {
  return `${location}, às ${formatTimeSafe(time)}`;
}

export default function ScheduleView({
  data,
  month,
  year,
  acolytes,
}: ScheduleViewProps) {
  const acolyteMap = new Map(acolytes.map((a) => [a.id, a.name]));

  const [hoveredAcolyte, setHoveredAcolyte] = useState<string | null>(null);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const getName = (id: string) => acolyteMap.get(id) || id;

  // 1. Coletar todas as entradas
  // Usamos any aqui para evitar erro de tipagem caso ScheduleEntry não esteja exportado
  const allEntries: any[] = data.sections.flatMap((s) => s.entries);

  // Contador de escalas por acólito
  const acolyteCount = new Map<string, number>();

  allEntries.forEach((entry) => {
    entry.acolytes.forEach((id: string) => {
      acolyteCount.set(id, (acolyteCount.get(id) || 0) + 1);
    });
  });

  const acolyteStats = Array.from(acolyteCount.entries())
    .map(([id, count]) => ({
      name: getName(id),
      count,
    }))
    .sort((a, b) => b.count - a.count); // maior → menor

  // 2. Extrair todas as datas únicas e ordená-las
  const uniqueDates = [...new Set(allEntries.map((e) => e.date))].sort();

  // 3. Extrair todas as combinações únicas de Local + Horário (+ Dia da Semana)
  const uniqueLocTimeCombos = allEntries.reduce((acc, entry) => {
    // 🔥 Adicione o dayOfWeek na chave aqui:
    const key = `${entry.dayOfWeek}|${entry.location}|${entry.time}`;

    if (!acc.has(key)) {
      acc.set(key, {
        display: formatLocationAndTime(entry.location, entry.time),
        timeSort: entry.time,
        dayOfWeek: entry.dayOfWeek,
      });
    }
    return acc;
  }, new Map<string, { display: string; timeSort: string; dayOfWeek: number }>());

  const sortedLocTimeKeys = Array.from(uniqueLocTimeCombos.keys()).sort(
    (a, b) => {
      const aData = uniqueLocTimeCombos.get(a)!;
      const bData = uniqueLocTimeCombos.get(b)!;
      return aData.timeSort.localeCompare(bData.timeSort);
    },
  );

  // 4. Criar um mapa para acesso rápido: grid[data][localTimeKey] = string de acólitos
  const grid = new Map<string, Map<string, string>>();
  allEntries.forEach((entry) => {
    // 🔥 E adicione o dayOfWeek na chave aqui também:
    const locTimeKey = `${entry.dayOfWeek}|${entry.location}|${entry.time}`;

    if (!grid.has(entry.date)) {
      grid.set(entry.date, new Map());
    }
    const acolytesList = entry.acolytes.map(getName).join(" / ");
    grid.get(entry.date)!.set(locTimeKey, acolytesList || "—");
  });

  // Array com os índices dos dias da semana (0 = Domingo, 1 = Segunda... 6 = Sábado)
  const allDaysOfWeek = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-block border-b-2 border-accent pb-2">
          <h1 className="text-2xl md:text-3xl font-heading font-semibold tracking-wide text-foreground">
            Escala de Acólitos
          </h1>
        </div>
        <p className="text-lg font-heading text-accent">
          {MONTH_NAMES[month - 1]} de {year}
        </p>
        <p className="text-sm text-muted-foreground">
          Paróquia Santo Antônio — Rancharia/SP
        </p>
      </div>

      {/* Loop dinâmico para renderizar as tabelas de cada dia da semana */}
      {allDaysOfWeek.map((dayIndex) => {
        // Filtra as datas que caem neste dia da semana
        const datesForDay = uniqueDates.filter(
          (date) => new Date(date + "T12:00:00").getDay() === dayIndex,
        );

        // Se não houver escala para este dia na semana, pula a renderização
        if (datesForDay.length === 0) return null;

        // Filtra as linhas (Local/Horário) que pertencem a este dia
        const keysForDay = sortedLocTimeKeys.filter(
          (key) => uniqueLocTimeCombos.get(key)!.dayOfWeek === dayIndex,
        );

        return (
          <div key={dayIndex} className="space-y-3">
            <div className="overflow-x-auto border border-border/70 rounded-md bg-card shadow-inner">
              <table className="w-full text-xs md:text-sm border-collapse">
                <thead>
                  {/* Título da Seção (ex: TERÇA-FEIRA) */}
                  <tr>
                    <th
                      colSpan={datesForDay.length + 1}
                      className="font-bold text-center py-3 bg-muted/60 text-foreground border border-border"
                    >
                      {DAY_NAMES[dayIndex]}
                    </th>
                  </tr>
                  {/* Cabeçalhos das Colunas (Datas) */}
                  <tr className="border border-border">
                    <th className="text-left font-semibold py-2 px-3 bg-muted/30 text-muted-foreground w-40 md:w-48 border-r border-border">
                      Local/Horário
                    </th>
                    {datesForDay.map((date) => (
                      <th
                        key={date}
                        className="font-semibold text-center py-2 px-3 bg-muted/30 text-muted-foreground border-r border-border last:border-r-0"
                      >
                        {formatDateBR(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Linhas de Local + Horário */}
                  {keysForDay.map((key) => {
                    const locTimeData = uniqueLocTimeCombos.get(key)!;
                    return (
                      <tr
                        key={key}
                        className="border border-border hover:bg-secondary/20 transition-colors"
                      >
                        <td className="text-left font-medium py-3 px-3 border-r border-border text-foreground">
                          {locTimeData.display}
                        </td>
                        {/* Células com os nomes dos Acólitos */}
                        {datesForDay.map((date) => {
                          const acolytesList = grid.get(date)?.get(key);
                          const entry = allEntries.find(
                            (e) =>
                              e.date === date &&
                              `${e.dayOfWeek}|${e.location}|${e.time}` === key,
                          );

                          const isHighlighted =
                            hoveredAcolyte &&
                            entry?.acolytes?.includes(hoveredAcolyte);
                          return (
                            <td
                              className={`text-center py-3 px-3 border-r border-border last:border-r-0 whitespace-pre-wrap transition-colors
    ${
      isHighlighted
        ? "bg-yellow-200/40 text-foreground font-semibold"
        : "text-muted-foreground"
    }
  `}
                            >
                              {(() => {
                                const entry = allEntries.find(
                                  (e) =>
                                    e.date === date &&
                                    `${e.dayOfWeek}|${e.location}|${e.time}` ===
                                      key,
                                );

                                if (!entry || !entry.acolytes?.length) {
                                  return (
                                    <span className="text-muted-foreground/50 italic">
                                      —
                                    </span>
                                  );
                                }

                                return entry.acolytes.map(
                                  (id: string, index: number) => {
                                    const name = getName(id);
                                    const count = acolyteCount.get(id) || 0;

                                    return (
                                      <span key={id}>
                                        <span
                                          title={`${name} está em ${count} escala${count > 1 ? "s" : ""}`}
                                          className="cursor-help hover:underline"
                                          onMouseEnter={() =>
                                            setHoveredAcolyte(id)
                                          }
                                          onMouseLeave={() =>
                                            setHoveredAcolyte(null)
                                          }
                                        >
                                          {name}
                                        </span>
                                        {index < entry.acolytes.length - 1 &&
                                          " / "}
                                      </span>
                                    );
                                  },
                                );
                              })()}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {isAdminRoute && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">
            Quantidade de Escalas por Acólito
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {acolyteStats.map((a) => (
              <div
                key={a.name}
                className="border rounded-md p-3 bg-muted/30 text-sm"
              >
                <p className="font-medium text-foreground">{a.name}</p>
                <p className="text-muted-foreground">
                  {a.count} escala{a.count > 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
