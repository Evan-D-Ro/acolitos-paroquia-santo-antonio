import { ScheduleData, MONTH_NAMES, Acolyte } from "@/types/schedule";
import { useState, useRef } from "react"; // Adicionado useRef
import { useLocation } from "react-router-dom";
import { toPng, toJpeg } from "html-to-image"; // Para exportação de imagem
import { jsPDF } from "jspdf"; // Para exportação de PDF
import { Button } from "@/components/ui/button"; // Assumindo que você usa Shadcn/ui
import { Download, FileImage, FileText } from "lucide-react"; // Ícones para os botões
import Swal from "sweetalert2";

interface ScheduleViewProps {
  data: ScheduleData;
  month: number;
  year: number;
  acolytes: Acolyte[];
  onUpdate?: (newData: ScheduleData) => void;
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
  onUpdate,
}: ScheduleViewProps) {
  const acolyteMap = new Map(acolytes.map((a) => [a.id, a.name]));
  const [hoveredAcolyte, setHoveredAcolyte] = useState<string | null>(null);
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const scheduleRef = useRef<HTMLDivElement>(null);
  const touchTimeout = useRef<NodeJS.Timeout | null>(null);
  const getName = (id: string) => acolyteMap.get(id) || id;

  // Lógica de exportação para Imagem (JPEG)
  const downloadImage = async () => {
    if (!scheduleRef.current) return;

    try {
      setIsExporting(true);

      // ⏳ espera o React aplicar as classes
      await new Promise((r) => setTimeout(r, 150));

      const dataUrl = await toJpeg(scheduleRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const link = document.createElement("a");
      link.download = `escala-${month}-${year}.jpg`;
      link.href = dataUrl;
      link.click();
      Swal.fire({
        position: "center",
        icon: "success",
        title: "Imagem gerada com sucesso!",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Lógica de exportação para PDF
  const downloadPDF = async () => {
    if (!scheduleRef.current) return;

    try {
      setIsExporting(true);

      const dataUrl = await toPng(scheduleRef.current, {
        pixelRatio: 2, // Aumenta a qualidade no PDF
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`escala-acolitos-${month}-${year}.pdf`);
      Swal.fire({
        position: "center",
        icon: "success",
        title: "Arquivo PDF gerado com sucesso!",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
      setIsExporting(false);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
    }
  };

  // 1. Coletar todas as entradas
  // Usamos any aqui para evitar erro de tipagem caso ScheduleEntry não esteja exportado
  const allEntries: any[] = data.sections.flatMap((s, sIdx) =>
    s.entries.map((e, eIdx) => ({
      ...e,
      sectionIdx: sIdx,
      entryIdx: eIdx,
    })),
  );

  const acolyteCount = new Map<string, number>();
  allEntries.forEach((entry) => {
    entry.acolytes.forEach((id: string) => {
      acolyteCount.set(id, (acolyteCount.get(id) || 0) + 1);
    });
  });

  const acolyteStats = Array.from(acolyteCount.entries())
    .map(([id, count]) => ({ name: getName(id), count }))
    .sort((a, b) => b.count - a.count);

  // 2. Extrair todas as datas únicas e ordená-las
  const uniqueDates = [...new Set(allEntries.map((e) => e.date))].sort();

  const uniqueLocTimeCombos = allEntries.reduce((acc, entry, index) => {
    const key = `${entry.dayOfWeek}|${entry.location}|${entry.time}`;
    if (!acc.has(key)) {
      acc.set(key, {
        display: formatLocationAndTime(entry.location, entry.time),
        location: entry.location,
        time: entry.time,
        timeSort: entry.time,
        dayOfWeek: entry.dayOfWeek,
        sectionIdx: entry.sectionIdx,
        firstSeenIndex: index,
        count: 1,
      });
    } else {
      acc.get(key)!.count += 1;
    }
    return acc;
  }, new Map<string, { display: string; location: string; time: string; timeSort: string; dayOfWeek: number; sectionIdx: number; firstSeenIndex: number; count: number }>());

  const sortedLocTimeKeys = Array.from(uniqueLocTimeCombos.keys()).sort(
    (a, b) => {
      const aData = uniqueLocTimeCombos.get(a)!;
      const bData = uniqueLocTimeCombos.get(b)!;
      const getPriority = (data: (typeof aData)) => {
        if (data.dayOfWeek !== 6) return 100;
        if (data.location.includes("Agissê")) return 1;
        if (data.location.includes("São Judas")) return 0;
        return 10;
      };

      const priorityA = getPriority(aData);
      const priorityB = getPriority(bData);

      if (priorityA !== priorityB) return priorityA - priorityB;
      return aData.firstSeenIndex - bData.firstSeenIndex;
    },
  );

  const grid = new Map<string, Map<string, string>>();
  allEntries.forEach((entry) => {
    const locTimeKey = `${entry.dayOfWeek}|${entry.location}|${entry.time}`;
    if (!grid.has(entry.date)) grid.set(entry.date, new Map());
    const acolytesList = entry.acolytes.map(getName).join(" / ");
    grid.get(entry.date)!.set(locTimeKey, acolytesList || "—");
  });

  const allDaysOfWeek = [0, 6, 1, 2, 3, 4, 5];
  const [search, setSearch] = useState("");

  const matchesSearch = (entry: any) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    const hasName = entry.acolytes.some((id: string) =>
      getName(id).toLowerCase().includes(searchLower),
    );
    const hasSolemnity = (entry.solemnityName || "")
      .toLowerCase()
      .includes(searchLower);
    const hasRole = Object.values(entry.acolyteRoles || {}).some((role: any) =>
      String(role).toLowerCase().includes(searchLower),
    );

    return hasName || hasSolemnity || hasRole;
  };

  const [isExporting, setIsExporting] = useState(false);

  // =======================================================================
  // 2. Lógica de Alteração e Remoção (Modal e Atualização do Data)
  // =======================================================================
  const upsertEntry = (
    sectionIdx: number,
    entryIdx: number | undefined,
    entryTemplate: any,
    updates: Partial<any>,
  ) => {
    if (!onUpdate) return;

    const newData = {
      ...data,
      sections: data.sections.map((section, sIdx) => {
        if (sIdx !== sectionIdx) return section;

        return {
          ...section,
          entries:
            entryIdx === undefined
              ? [
                  ...section.entries,
                  {
                    date: entryTemplate.date,
                    dayOfWeek: entryTemplate.dayOfWeek,
                    location: entryTemplate.location,
                    time: entryTemplate.time,
                    acolytes: entryTemplate.acolytes || [],
                    isSolemn: entryTemplate.isSolemn || false,
                    solemnityName: entryTemplate.solemnityName || "",
                    acolyteRoles: entryTemplate.acolyteRoles || {},
                    ...updates,
                  },
                ]
              : section.entries.map((entry, eIdx) =>
                  eIdx === entryIdx ? { ...entry, ...updates } : entry,
                ),
        };
      }),
    };

    onUpdate(newData);
  };

  const updateEntryAcolytes = (
    sectionIdx: number,
    entryIdx: number | undefined,
    entryTemplate: any,
    newAcolytes: string[],
  ) => {
    const filteredRoles = Object.fromEntries(
      Object.entries(entryTemplate.acolyteRoles || {}).filter(([id]) =>
        newAcolytes.includes(id),
      ),
    );
    upsertEntry(sectionIdx, entryIdx, entryTemplate, {
      acolytes: newAcolytes,
      acolyteRoles: filteredRoles,
    });
  };

  const clearTouchTimeout = () => {
    if (touchTimeout.current) clearTimeout(touchTimeout.current);
  };

  // =======================================================================
  // Lógica Unificada de Gerenciamento da Célula
  // =======================================================================
  const manageCell = async (entry: any) => {
    if (!isAdminRoute || !entry) return;

    const dateFormatted = formatDateBR(entry.date);
    const locTime = formatLocationAndTime(entry.location, entry.time);

    const saveSolemnityDetails = async () => {
      const roleRows = entry.acolytes
        .map((id: string, index: number) => {
          const role = entry.acolyteRoles?.[id] || "";
          return `
            <div class="swal2-field" style="margin-top:8px;text-align:left;">
              <label style="display:block;font-size:12px;margin-bottom:4px;">${getName(id)}</label>
              <input id="role-${index}" class="swal2-input" style="width:100%;margin:0;" value="${role}" placeholder="Função" />
            </div>
          `;
        })
        .join("");

      const { value } = await Swal.fire({
        title: "Detalhes da missa",
        html: `
          <div style="display:grid;gap:12px;text-align:left;">
            <label style="display:flex;align-items:center;gap:8px;">
              <input id="is-solemn" type="checkbox" ${entry.isSolemn ? "checked" : ""} />
              <span>Missa solene</span>
            </label>
            <div>
              <label style="display:block;font-size:12px;margin-bottom:4px;">Solenidade</label>
              <input id="solemnity-name" class="swal2-input" style="width:100%;margin:0;" value="${entry.solemnityName || ""}" placeholder="Ex: Corpus Christi" />
            </div>
            ${roleRows}
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Salvar",
        cancelButtonText: "Cancelar",
        focusConfirm: false,
        didOpen: () => {
          const modal = Swal.getPopup();
          if (!modal) return;
          const checkbox = modal.querySelector<HTMLInputElement>("#is-solemn");
          const nameInput = modal.querySelector<HTMLInputElement>("#solemnity-name");
          const roleInputs = modal.querySelectorAll<HTMLInputElement>('[id^="role-"]');

          const toggleRoleInputs = () => {
            const enabled = checkbox?.checked;
            roleInputs.forEach((input) => {
              input.disabled = !enabled;
            });
            if (nameInput) nameInput.disabled = !enabled;
          };

          checkbox?.addEventListener("change", toggleRoleInputs);
          toggleRoleInputs();
        },
        preConfirm: () => {
          const modal = Swal.getPopup();
          if (!modal) return null;

          const isSolemn = modal.querySelector<HTMLInputElement>("#is-solemn")?.checked ?? false;
          const solemnityName = modal.querySelector<HTMLInputElement>("#solemnity-name")?.value.trim() || "";
          const acolyteRoles = Object.fromEntries(
            entry.acolytes.map((id: string, index: number) => {
              const value =
                modal.querySelector<HTMLInputElement>(`#role-${index}`)?.value.trim() || "";
              return [id, value];
            }).filter(([, value]) => value),
          );

          return { isSolemn, solemnityName, acolyteRoles };
        },
      });

      if (value) {
        upsertEntry(entry.sectionIdx, entry.entryIdx, entry, {
          isSolemn: value.isSolemn,
          solemnityName: value.isSolemn ? value.solemnityName : "",
          acolyteRoles: value.isSolemn ? value.acolyteRoles : {},
        });
      }
    };

    // Função interna auxiliar para o fluxo de Adicionar
    const handleAdd = async () => {
      const availableAcolytes = acolytes
        .filter((a) => a.active && !entry.acolytes.includes(a.id))
        .reduce((acc, a) => ({ ...acc, [a.id]: a.name }), {});

      if (Object.keys(availableAcolytes).length === 0) {
        return Swal.fire({
          icon: "info",
          title: "Aviso",
          text: "Todos os acólitos ativos já estão nesta escala!",
        });
      }

      const { value: newId } = await Swal.fire({
        title: "Adicionar Acólito",
        html: `Escala: <b>${dateFormatted}</b> - ${locTime}`,
        input: "select",
        inputOptions: availableAcolytes,
        inputPlaceholder: "Escolha um acólito...",
        showCancelButton: true,
        confirmButtonText: "Adicionar",
        cancelButtonText: "Cancelar",
      });

      if (newId) {
        updateEntryAcolytes(entry.sectionIdx, entry.entryIdx, entry, [
          ...entry.acolytes,
          newId,
        ]);
      }
    };

    const actions: Record<string, string> = {
      add: "Adicionar Acólito",
      details: "Editar detalhes",
    };

    if (entry.acolytes && entry.acolytes.length > 0) {
      actions.edit = "Substituir Acólito";
      actions.remove = "Remover Acólito";
    }

    // 1. Se a escala estiver vazia, permite adicionar ou editar detalhes
    if (!entry.acolytes || entry.acolytes.length === 0) {
      const { value: emptyAction } = await Swal.fire({
        title: "Gerenciar Escala",
        html: `<b>${dateFormatted}</b> - ${locTime}`,
        input: "select",
        inputOptions: {
          details: "Editar detalhes",
          add: "Adicionar Acólito",
        },
        inputPlaceholder: "Escolha uma ação...",
        inputValidator: (value) => (!value ? "Escolha uma opção!" : null),
        showCancelButton: true,
        confirmButtonText: "Continuar",
        cancelButtonText: "Cancelar",
      });

      if (!emptyAction) return;
      if (emptyAction === "add") return handleAdd();
      if (emptyAction === "details") return saveSolemnityDetails();
      return;
    }

    // 2. Se já tiver gente, pergunta o que o administrador quer fazer
    const { value: action } = await Swal.fire({
      title: "Gerenciar Escala",
      html: `<b>${dateFormatted}</b> - ${locTime}`,
      input: "select",
      inputOptions: actions,
      inputPlaceholder: "Escolha uma ação...",
      inputValidator: (value) => (!value ? "Escolha uma opção!" : null),
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
    });

    if (!action) return; // Cancelou

    if (action === "add") {
      return handleAdd();
    }

    if (action === "details") {
      return saveSolemnityDetails();
    }

    // 3. Fluxo de Substituir ou Remover (precisa escolher qual acólito)
    const currentAcolytes = entry.acolytes.reduce(
      (acc: any, id: string) => ({ ...acc, [id]: getName(id) }),
      {},
    );

    const { value: selectedId } = await Swal.fire({
      title: action === "edit" ? "Substituir quem?" : "Remover quem?",
      input: "select",
      inputOptions: currentAcolytes,
      inputPlaceholder: "Selecione o acólito...",
      showCancelButton: true,
      confirmButtonText: action === "edit" ? "Escolher Substituto" : "Remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: action === "remove" ? "#d33" : "#3085d6",
      inputValidator: (val) => (!val ? "Selecione um!" : null),
    });

    if (!selectedId) return; // Cancelou

    if (action === "remove") {
      const newAcolytes = entry.acolytes.filter(
        (id: string) => id !== selectedId,
      );
      updateEntryAcolytes(
        entry.sectionIdx,
        entry.entryIdx,
        entry,
        newAcolytes,
      );
    } else if (action === "edit") {
      const availableAcolytes = acolytes
        .filter((a) => a.active && !entry.acolytes.includes(a.id))
        .reduce((acc, a) => ({ ...acc, [a.id]: a.name }), {});

      const { value: newId } = await Swal.fire({
        title: `Substituir ${getName(selectedId)} por:`,
        input: "select",
        inputOptions: availableAcolytes,
        inputPlaceholder: "Escolha um substituto...",
        showCancelButton: true,
        confirmButtonText: "Substituir",
      });

      if (newId) {
        const newAcolytes = entry.acolytes.map((id: string) =>
          id === selectedId ? newId : id,
        );
        updateEntryAcolytes(
          entry.sectionIdx,
          entry.entryIdx,
          entry,
          newAcolytes,
        );
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Botões de Exportação - Visíveis apenas se houver dados */}

      {data && isAdminRoute && (
        <div className="flex flex-wrap justify-end gap-2 mb-4 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadImage}
            className="w-full gap-2 sm:w-auto"
          >
            <FileImage className="h-4 w-4" /> Exportar JPEG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadPDF}
            className="w-full gap-2 sm:w-auto"
          >
            <FileText className="h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      )}

      <div
        ref={scheduleRef}
        className="bg-background rounded-lg px-0 sm:px-4 md:pb-20 md:px-20"
      >
        {isAdminRoute && (
          <div className="text-center space-y-2">
            <div className="inline-block border-b-2 border-accent pb-2">
              <h1 className="text-2xl md:text-3xl font-heading font-semibold tracking-wide text-foreground">
                Escala de Acólitos
              </h1>
            </div>
            <p className="text-lg font-heading text-accent">
              {MONTH_NAMES[month - 1]} de {year}
            </p>
            <p className="text-sm text-muted-foreground pb-4">
              Paróquia Santo Antônio — Rancharia/SP
            </p>
          </div>
        )}
        {!isExporting && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Digite o nome do acólito..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
        )}
        {/* Loop dinâmico para renderizar as tabelas de cada dia da semana */}
        {allDaysOfWeek.map((dayIndex) => {
          // Filtra as datas que caem neste dia da semana
          const datesForDay = uniqueDates.filter((date) => {
            const isSameDay =
              new Date(date + "T12:00:00").getDay() === dayIndex;

            if (!isSameDay) return false;

            // verifica se existe pelo menos uma escala com o nome buscado nesse dia
            const hasMatch = allEntries.some(
              (entry) => entry.date === date && matchesSearch(entry),
            );

            return hasMatch;
          });

          // Se não houver escala para este dia na semana, pula a renderização
          if (datesForDay.length === 0) return null;

          // Filtra as linhas (Local/Horário) que pertencem a este dia
          const keysForDay = sortedLocTimeKeys.filter(
            (key) => uniqueLocTimeCombos.get(key)!.dayOfWeek === dayIndex,
          );

          return (
            <div key={dayIndex} className="space-y-3 pb-6">
                <div
                  className={`border border-border/70 rounded-md bg-card shadow-inner ${
                    isExporting
                      ? "overflow-visible [&::-webkit-scrollbar]:hidden"
                      : "overflow-x-auto"
                  }`}
                >
                <table className="w-full table-fixed border-collapse text-[10px] leading-tight sm:text-xs md:text-sm">
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
                      <th className="w-[5.5rem] break-words bg-muted/30 px-1.5 py-2 text-left font-semibold text-muted-foreground sm:w-40 sm:px-3 md:w-48 border-r border-border">
                        Local/Horário
                      </th>
                      {datesForDay.map((date) => (
                        <th
                          key={date}
                          className="break-words bg-muted/30 px-1 py-2 text-center font-semibold text-muted-foreground sm:px-3 border-r border-border last:border-r-0"
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
                          <td className="break-words border-r border-border px-1.5 py-2 text-left font-medium text-foreground sm:px-3 sm:py-3">
                            {locTimeData.display}
                          </td>
                          {/* Células com os nomes dos Acólitos */}
                          {datesForDay.map((date) => {
                            const isHighlighted =
                              hoveredAcolyte &&
                              grid
                                .get(date)
                                ?.get(key)
                                ?.includes(
                                  acolyteMap.get(hoveredAcolyte) || "",
                                );
                            const entry = allEntries.find(
                              (e) =>
                                e.date === date &&
                                `${e.dayOfWeek}|${e.location}|${e.time}` ===
                                  key,
                            );
                            const editableEntry =
                              entry ||
                              (isAdminRoute
                                ? {
                                    date,
                                    dayOfWeek: dayIndex,
                                    location: locTimeData.location,
                                    time: locTimeData.time,
                                    acolytes: [],
                                    isSolemn: false,
                                    solemnityName: "",
                                    acolyteRoles: {},
                                    sectionIdx: locTimeData.sectionIdx,
                                    entryIdx: undefined,
                                  }
                                : null);

                            return (
                              <td
                                key={date}
                                // 1. Evento para Computador (Botão Direito)
                                onContextMenu={(e) => {
                                  if (!isAdminRoute || !editableEntry) return;
                                  e.preventDefault(); // Impede de abrir o menu padrão do navegador
                                  manageCell(editableEntry);
                                }}
                                // 2. Eventos para Celular (Toque longo de 600ms)
                                onTouchStart={() => {
                                  if (!isAdminRoute || !editableEntry) return;
                                  touchTimeout.current = setTimeout(() => {
                                    manageCell(editableEntry);
                                  }, 600);
                                }}
                                onTouchEnd={clearTouchTimeout}
                                onTouchMove={clearTouchTimeout}
                                title={
                                  isAdminRoute && editableEntry
                                    ? "Clique com o botão direito (ou segure) para gerenciar"
                                    : ""
                                }
                                className={`break-words border-r border-border px-1.5 py-2 text-center last:border-r-0 sm:px-3 sm:py-3 whitespace-pre-wrap transition-colors ${
                                  entry?.isSolemn
                                    ? "bg-amber-100/70 text-foreground"
                                    : isHighlighted
                                      ? "bg-yellow-200/40 text-foreground font-semibold"
                                      : "text-muted-foreground"
                                } ${isAdminRoute && editableEntry ? "hover:bg-muted/30" : ""}`}
                              >
                                {(() => {
                                  // Se a escala não existir ou estiver vazia
                                  if (
                                    !entry ||
                                    !entry.acolytes?.length ||
                                    !matchesSearch(entry)
                                  ) {
                                    return (
                                      <div className="flex min-w-0 flex-col items-center gap-1">
                                        {entry?.isSolemn && (
                                          <div className="max-w-full break-words text-[9px] font-semibold uppercase tracking-wide text-amber-700 sm:text-[11px]">
                                            {entry.solemnityName?.trim() ||
                                              "Missa solene"}
                                          </div>
                                        )}
                                        <span className="text-muted-foreground/50 italic">
                                          —
                                        </span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div className="flex min-w-0 flex-col items-center gap-1">
                                      {entry.isSolemn && (
                                        <div className="max-w-full break-words text-[9px] font-semibold uppercase tracking-wide text-amber-700 sm:text-[11px]">
                                          {entry.solemnityName?.trim() ||
                                            "Missa solene"}
                                        </div>
                                      )}
                                      {entry.acolytes.map(
                                        (id: string, index: number) => {
                                          const name = getName(id);
                                          const count =
                                            acolyteCount.get(id) || 0;
                                          const role =
                                            entry.acolyteRoles?.[id]?.trim();

                                          return (
                                            <div
                                              key={id}
                                              className="flex min-w-0 max-w-full flex-col items-center"
                                            >
                                              {/* Nome */}

                                              <span
                                                title={`${name} está em ${count} escala${count > 1 ? "s" : ""}`}
                                                className="max-w-full break-words font-bold hover:underline cursor-help"
                                                onMouseEnter={() =>
                                                  setHoveredAcolyte(id)
                                                }
                                                onMouseLeave={() =>
                                                  setHoveredAcolyte(null)
                                                }
                                              >
                                                {name}
                                              </span>
                                              {entry.isSolemn && role && (
                                                <span className="max-w-full break-words text-[9px] font-medium text-muted-foreground sm:text-[11px]">
                                                  {role}
                                                </span>
                                              )}

                                              {/* Separador (se não for o último) */}
                                              {index <
                                                entry.acolytes.length - 1 && (
                                                <span className="text-muted-foreground opacity-60">
                                                  |
                                                </span>
                                              )}
                                            </div>
                                          );
                                        },
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                            );
                          })}{" "}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
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
