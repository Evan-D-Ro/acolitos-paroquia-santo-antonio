import {
  Acolyte,
  ScheduleEntry,
  ScheduleSection,
  ScheduleData,
  VariableRule,
  RuleViolation,
  SUNDAY_MASSES,
  SATURDAY_MASSES,
  SATURDAY_BIWEEKLY_MASS,
  SATURDAY_HOSPITAL_MASS,
  WEEKDAY_MASSES,
  FIRST_FRIDAY_MASS,
  DEFAULT_SCHEDULE_SETTINGS,
  ScheduleSettings,
} from "@/types/schedule";

// ========== DATE HELPERS ==========

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isNthDayOfMonth(date: Date, dayOfWeek: number, n: number): boolean {
  if (date.getDay() !== dayOfWeek) return false;
  const d = date.getDate();
  return Math.ceil(d / 7) === n;
}

function getWeekNumber(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDateBR(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}`;
}

// ========== CONFIGURABLE RULES ==========

function mergeSettings(settings?: Partial<ScheduleSettings>): ScheduleSettings {
  return {
    ...DEFAULT_SCHEDULE_SETTINGS,
    ...settings,
    weekendOnlyNames:
      settings?.weekendOnlyNames ?? DEFAULT_SCHEDULE_SETTINGS.weekendOnlyNames,
    weakAcolytes:
      settings?.weakAcolytes ?? DEFAULT_SCHEDULE_SETTINGS.weakAcolytes,
    lowCommitmentNames:
      settings?.lowCommitmentNames ??
      DEFAULT_SCHEDULE_SETTINGS.lowCommitmentNames,
    couples: settings?.couples ?? DEFAULT_SCHEDULE_SETTINGS.couples,
    individualRestrictions:
      settings?.individualRestrictions ??
      DEFAULT_SCHEDULE_SETTINGS.individualRestrictions,
    targetChapelLocationIncludes:
      settings?.targetChapelLocationIncludes ??
      DEFAULT_SCHEDULE_SETTINGS.targetChapelLocationIncludes,
  };
}

function locationMatches(location: string, terms: string[] = []): boolean {
  return terms.some((term) => term && location.includes(term));
}

function canServe(
  acolyte: Acolyte,
  entry: { date: string; dayOfWeek: number; location: string; time: string },
  variableRules: VariableRule[],
  isVacation: boolean,
  settings: ScheduleSettings,
): boolean {
  const name = acolyte.name;
  const dow = entry.dayOfWeek;
  const isWeekend = dow === 0 || dow === 6;

  // Vacation-only (Caio, Beatriz)
  if (acolyte.vacation_only && !isVacation) return false;

  // Weekend-only people
  if (settings.weekendOnlyNames.includes(name) && !isWeekend) return false;

  const individualRule = settings.individualRestrictions.find(
    (rule) => rule.name === name,
  );
  if (individualRule) {
    if (individualRule.onlyWeekends && !isWeekend) return false;
    if (
      individualRule.onlyDayOfWeek !== undefined &&
      dow !== individualRule.onlyDayOfWeek
    )
      return false;
    if (
      individualRule.allowedTimes?.length &&
      !individualRule.allowedTimes.includes(entry.time)
    )
      return false;
    if (
      individualRule.requiredLocationIncludes?.length &&
      !locationMatches(entry.location, individualRule.requiredLocationIncludes)
    )
      return false;
    if (
      individualRule.blockedLocationIncludes?.length &&
      locationMatches(entry.location, individualRule.blockedLocationIncludes)
    )
      return false;
  }

  // Allana: always on Friday (handled by preference, not restriction here)

  // Variable rules: unavailable dates
  const acolyteVarRules = variableRules.filter(
    (r) => r.acolyte_id === acolyte.id,
  );
  for (const rule of acolyteVarRules) {
    if (rule.rule_type === "unavailable_date") {
      const dates = rule.rule_data.dates || [];
      if (dates.includes(entry.date)) return false;
    }
  }

  return true;
}

// ========== SCHEDULE GENERATION ==========

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateSchedule(
  year: number,
  month: number,
  acolytes: Acolyte[],
  variableRules: VariableRule[],
  isVacation: boolean = false,
  rawSettings?: Partial<ScheduleSettings>,
): ScheduleData {
  const settings = mergeSettings(rawSettings);
  const days = getDaysInMonth(year, month);
  const activeAcolytes = acolytes.filter((a) => a.active);

  // Track assignments count per acolyte
  const assignmentCount: Record<string, number> = {};
  activeAcolytes.forEach((a) => {
    assignmentCount[a.id] = 0;
  });

  // Track last chapel per acolyte (for no-repeat rule)
  const lastWeekendChapel: Record<string, string> = {};

  // Get max assignments from variable rules
  const maxAssignments: Record<string, number> = {};
  variableRules.forEach((r) => {
    if (r.rule_type === "max_assignments" && r.rule_data.max) {
      maxAssignments[r.acolyte_id] = r.rule_data.max;
    }
  });

  const sections: ScheduleSection[] = [];

  // Helper to pick acolytes for a slot
  function pickAcolytes(
    entry: { date: string; dayOfWeek: number; location: string; time: string },
    count: number,
    preference?: string, // acolyte name to prefer
  ): string[] {
    const picked: Acolyte[] = [];
    const isWeekend = entry.dayOfWeek === 0 || entry.dayOfWeek === 6;

    const isTargetChapel = locationMatches(
      entry.location,
      settings.targetChapelLocationIncludes,
    );
    if (entry.dayOfWeek === 6 && isTargetChapel) {
      const fixedAcolyte = activeAcolytes.find(
        (a) => a.name === settings.targetChapelAcolyteName,
      );
      if (fixedAcolyte) {
        picked.push(fixedAcolyte);
        assignmentCount[fixedAcolyte.id] =
          (assignmentCount[fixedAcolyte.id] || 0) + 1;
        lastWeekendChapel[fixedAcolyte.id] = `${entry.location}|${entry.time}`;
      }
    }

    // Se a missa só precisar de 1 acólito e a Maria já pegou, encerra aqui
    if (picked.length >= count) {
      return picked.map((a) => a.id);
    }

    // 2. Filtra os elegíveis (removendo quem já foi forçado na etapa anterior)
    const eligible = activeAcolytes.filter((a) => {
      if (picked.some((p) => p.id === a.id)) return false; // Já foi escalado à força
      if (!canServe(a, entry, variableRules, isVacation, settings))
        return false;
      // Check max assignments
      if (
        maxAssignments[a.id] !== undefined &&
        assignmentCount[a.id] >= maxAssignments[a.id]
      )
        return false;
      return true;
    });

    // 3. Ordena os elegíveis para balancear a escala
    const sorted = shuffle(eligible).sort((a, b) => {
      // Em vez de barrar completamente, damos um peso artificial.
      // O algoritmo "finge" que Daniel e Kamily já começam o mês com 2 escalas prontas.
      const penaltyA = settings.lowCommitmentNames.includes(a.name)
        ? settings.lowCommitmentPenalty
        : 0;
      const penaltyB = settings.lowCommitmentNames.includes(b.name)
        ? settings.lowCommitmentPenalty
        : 0;

      const scoreA = (assignmentCount[a.id] || 0) + penaltyA;
      const scoreB = (assignmentCount[b.id] || 0) + penaltyB;

      return scoreA - scoreB;
    });

    // 4. Aplica a preferência (ex: Giovana em Santa Tereza)
    if (preference) {
      const prefIdx = sorted.findIndex((a) => a.name === preference);
      if (prefIdx > 0) {
        const [pref] = sorted.splice(prefIdx, 1);
        sorted.unshift(pref);
      }
    }

    // 5. Evita o mesmo local E horário dois fins de semana seguidos
    const locTimeKey = `${entry.location}|${entry.time}`; // 🔥 Cria uma chave única de Local+Horário
    const filtered = isWeekend
      ? sorted
          .filter((a) => lastWeekendChapel[a.id] !== locTimeKey)
          .concat(sorted.filter((a) => lastWeekendChapel[a.id] === locTimeKey))
      : sorted;

    // 6. Preenche as vagas restantes evitando deixar apenas acólitos fracos
    const uniqueFiltered = [
      ...new Map(filtered.map((a) => [a.id, a])).values(),
    ];

    for (const a of uniqueFiltered) {
      if (picked.length >= count) break;

      // If we'd have only weak acolytes, skip weak ones until we have a strong one
      if (count >= 2 && picked.length === count - 1) {
        const allWeak = [...picked, a].every((p) =>
          settings.weakAcolytes.includes(p.name),
        );
        if (allWeak) {
          const strong = uniqueFiltered.find(
            (s) =>
              !settings.weakAcolytes.includes(s.name) &&
              !picked.find((p) => p.id === s.id) &&
              s.id !== a.id,
          );
          if (strong) {
            picked.push(strong);
            assignmentCount[strong.id] = (assignmentCount[strong.id] || 0) + 1;
            if (isWeekend) lastWeekendChapel[strong.id] = locTimeKey;
            continue;
          }
        }
      }

      picked.push(a);
      assignmentCount[a.id] = (assignmentCount[a.id] || 0) + 1;
      if (isWeekend) lastWeekendChapel[a.id] = locTimeKey;
    }

    return picked.map((a) => a.id);
  }

  // ---- SUNDAYS ----
  const sundays = days.filter((d) => d.getDay() === 0);
  const sundayEntries: ScheduleEntry[] = [];
  for (const sunday of sundays) {
    for (const mass of SUNDAY_MASSES) {
      const preference = mass.location.includes("Santa Ter")
        ? settings.santaTerezaPreferenceName
        : undefined;
      const ids = pickAcolytes(
        {
          date: formatDate(sunday),
          dayOfWeek: 0,
          location: mass.location,
          time: mass.time,
        },
        mass.requiredAcolytes,
        preference,
      );
      sundayEntries.push({
        date: formatDate(sunday),
        dayOfWeek: 0,
        location: mass.location,
        time: mass.time,
        acolytes: ids,
      });
    }
  }
  sections.push({ title: "Domingos", entries: sundayEntries });

  // ---- SATURDAYS ----
  const saturdays = days.filter((d) => d.getDay() === 6);
  const saturdayEntries: ScheduleEntry[] = [];

  for (const saturday of saturdays) {
    const weekNum = getWeekNumber(saturday);
    const dateStr = formatDate(saturday);

    // 1. Agissê/São Sebastião: sempre no 2º e 4º sábado do mês.
    if (weekNum === 2 || weekNum === 4) {
      const ids = pickAcolytes(
        {
          date: dateStr,
          dayOfWeek: 6,
          location: SATURDAY_BIWEEKLY_MASS.location,
          time: SATURDAY_BIWEEKLY_MASS.time,
        },
        SATURDAY_BIWEEKLY_MASS.requiredAcolytes,
        settings.targetChapelAcolyteName,
      );

      saturdayEntries.push({
        date: dateStr,
        dayOfWeek: 6,
        location: SATURDAY_BIWEEKLY_MASS.location,
        time: SATURDAY_BIWEEKLY_MASS.time,
        acolytes: ids,
      });
    }

    // 2. Hospital: Apenas no 2º Sábado
    if (weekNum === 2) {
      const ids = pickAcolytes(
        {
          date: dateStr,
          dayOfWeek: 6,
          location: SATURDAY_HOSPITAL_MASS.location,
          time: SATURDAY_HOSPITAL_MASS.time,
        },
        SATURDAY_HOSPITAL_MASS.requiredAcolytes,
      );

      saturdayEntries.push({
        date: dateStr,
        dayOfWeek: 6,
        location: SATURDAY_HOSPITAL_MASS.location,
        time: SATURDAY_HOSPITAL_MASS.time,
        acolytes: ids,
      });
    }

    // 3. Regular Saturday Masses (Executadas por último para preencher com quem sobrou)
    for (const mass of SATURDAY_MASSES) {
      const ids = pickAcolytes(
        {
          date: dateStr,
          dayOfWeek: 6,
          location: mass.location,
          time: mass.time,
        },
        mass.requiredAcolytes,
      );

      saturdayEntries.push({
        date: dateStr,
        dayOfWeek: 6,
        location: mass.location,
        time: mass.time,
        acolytes: ids,
      });
    }
  }
  sections.push({ title: "Sábados", entries: saturdayEntries });
  // ---- WEEKDAYS ----
  const weekdayEntries: ScheduleEntry[] = [];

  // Tuesdays and Wednesdays
  for (const mass of WEEKDAY_MASSES) {
    const weekdays = days.filter((d) => d.getDay() === mass.dayOfWeek);
    for (const day of weekdays) {
      const ids = pickAcolytes(
        {
          date: formatDate(day),
          dayOfWeek: mass.dayOfWeek,
          location: mass.slot.location,
          time: mass.slot.time,
        },
        mass.slot.requiredAcolytes,
      );
      weekdayEntries.push({
        date: formatDate(day),
        dayOfWeek: mass.dayOfWeek,
        location: mass.slot.location,
        time: mass.slot.time,
        acolytes: ids,
      });
    }
  }

  // First Friday
  const fridays = days.filter((d) => d.getDay() === 5);
  if (fridays.length > 0) {
    const firstFriday = fridays[0];
    // Allana has preference for Friday
    const ids = pickAcolytes(
      {
        date: formatDate(firstFriday),
        dayOfWeek: 5,
        location: FIRST_FRIDAY_MASS.location,
        time: FIRST_FRIDAY_MASS.time,
      },
      FIRST_FRIDAY_MASS.requiredAcolytes,
      settings.firstFridayPreferenceName,
    );
    weekdayEntries.push({
      date: formatDate(firstFriday),
      dayOfWeek: 5,
      location: FIRST_FRIDAY_MASS.location,
      time: FIRST_FRIDAY_MASS.time,
      acolytes: ids,
    });
  }

  sections.push({ title: "Dias de Semana", entries: weekdayEntries });

  return { sections };
}

// ========== VALIDATION ==========

export function validateSchedule(
  data: ScheduleData,
  acolytes: Acolyte[],
  variableRules: VariableRule[],
  isVacation: boolean = false,
  rawSettings?: Partial<ScheduleSettings>,
): RuleViolation[] {
  const settings = mergeSettings(rawSettings);
  const violations: RuleViolation[] = [];
  const acolyteMap = new Map(acolytes.map((a) => [a.id, a]));
  const dailyAssignments: Record<string, Record<string, number>> = {};
  const entriesByDate: Record<string, ScheduleEntry[]> = {};

  // Track assignments
  const assignmentCount: Record<string, number> = {};
  const weekendChapelHistory: Record<
    string,
    { location: string; time: string; date: string }[]
  > = {};

  // Max assignments from variable rules
  const maxAssignments: Record<string, number> = {};
  variableRules.forEach((r) => {
    if (r.rule_type === "max_assignments" && r.rule_data.max) {
      maxAssignments[r.acolyte_id] = r.rule_data.max;
    }
  });

  for (const section of data.sections) {
    for (const entry of section.entries) {
      if (!entriesByDate[entry.date]) entriesByDate[entry.date] = [];
      entriesByDate[entry.date].push(entry);

      for (const acolyteId of entry.acolytes) {
        const acolyte = acolyteMap.get(acolyteId);
        if (!acolyte) continue;

        assignmentCount[acolyteId] = (assignmentCount[acolyteId] || 0) + 1;

        // 🔥 COLE O BLOCO NOVO AQUI 🔥
        if (!dailyAssignments[acolyteId]) dailyAssignments[acolyteId] = {};
        dailyAssignments[acolyteId][entry.date] =
          (dailyAssignments[acolyteId][entry.date] || 0) + 1;

        if (dailyAssignments[acolyteId][entry.date] === 2) {
          violations.push({
            type: "warning",
            message: `${acolyte.name} está escalado(a) mais de uma vez no mesmo dia (${formatDateBR(new Date(entry.date + "T12:00:00"))})`,
            entry,
          });
        }
        // Check fixed rules
        if (!canServe(acolyte, entry, variableRules, isVacation, settings)) {
          violations.push({
            type: "error",
            message: `${acolyte.name} não pode servir em ${entry.location} ${entry.time} no dia ${formatDateBR(new Date(entry.date + "T12:00:00"))}`,
            entry,
          });
        }

        // Check weekend chapel repetition
        const isWeekend = entry.dayOfWeek === 0 || entry.dayOfWeek === 6;
        if (isWeekend) {
          const history = weekendChapelHistory[acolyteId] || [];

          // 🔥 AGORA VERIFICA SE O LOCAL E O HORÁRIO SÃO IGUAIS
          const lastSameChapel = history.filter(
            (h) => h.location === entry.location && h.time === entry.time,
          );

          if (lastSameChapel.length > 0) {
            const lastDate = new Date(
              lastSameChapel[lastSameChapel.length - 1].date,
            );
            const thisDate = new Date(entry.date);
            const diffDays =
              (thisDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

            // Ignorar o aviso se for a Maria Anália em suas capelas fixas
            const isMariaFixed =
              acolyte.name === settings.targetChapelAcolyteName &&
              locationMatches(
                entry.location,
                settings.targetChapelLocationIncludes,
              );

            if (diffDays <= 7 && !isMariaFixed) {
              violations.push({
                type: "warning",
                message: `${acolyte.name} está repetindo ${entry.location} às ${entry.time} em fins de semana seguidos`,
                entry,
              });
            }
          }
          if (!weekendChapelHistory[acolyteId])
            weekendChapelHistory[acolyteId] = [];

          // 🔥 SALVA O HORÁRIO NO HISTÓRICO
          weekendChapelHistory[acolyteId].push({
            location: entry.location,
            time: entry.time,
            date: entry.date,
          });
        }
      }

      // Check weak acolytes together
      if (entry.acolytes.length >= 2) {
        const allWeak = entry.acolytes.every((id) => {
          const a = acolyteMap.get(id);
          return a && settings.weakAcolytes.includes(a.name);
        });
        if (allWeak) {
          violations.push({
            type: "warning",
            message: `Somente acólitos com dificuldades juntos em ${entry.location} ${entry.time} (${formatDateBR(new Date(entry.date + "T12:00:00"))})`,
            entry,
          });
        }
      }

      // Check single weak acolyte alone
      if (entry.acolytes.length === 1) {
        const a = acolyteMap.get(entry.acolytes[0]);
        if (a && settings.weakAcolytes.includes(a.name)) {
          violations.push({
            type: "warning",
            message: `${a.name} (Acólito com dificuldade) está sozinho(a) em ${entry.location} ${entry.time} (${formatDateBR(new Date(entry.date + "T12:00:00"))})`,
            entry,
          });
        }
      }
    }
  }

  for (const [date, entries] of Object.entries(entriesByDate)) {
    for (const [firstName, secondName] of settings.couples) {
      const first = acolytes.find((a) => a.name === firstName);
      const second = acolytes.find((a) => a.name === secondName);
      if (!first || !second) continue;

      const firstEntries = entries.filter((entry) =>
        entry.acolytes.includes(first.id),
      );
      const secondEntries = entries.filter((entry) =>
        entry.acolytes.includes(second.id),
      );

      if (firstEntries.length === 0 || secondEntries.length === 0) continue;

      const servedTogether = entries.some(
        (entry) =>
          entry.acolytes.includes(first.id) &&
          entry.acolytes.includes(second.id),
      );

      if (!servedTogether) {
        violations.push({
          type: "warning",
          message: `${firstName} e ${secondName} estão no mesmo dia (${formatDateBR(new Date(date + "T12:00:00"))}), mas não na mesma missa`,
          entry: firstEntries[0],
        });
      }
    }
  }

  // Check max assignments
  for (const [acolyteId, max] of Object.entries(maxAssignments)) {
    const count = assignmentCount[acolyteId] || 0;
    if (count > max) {
      const a = acolyteMap.get(acolyteId);
      violations.push({
        type: "error",
        message: `${a?.name || "Acólito"} tem ${count} escalas (máximo definido: ${max})`,
      });
    }
  }

  return violations;
}
