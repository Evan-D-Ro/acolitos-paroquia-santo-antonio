import { describe, expect, it } from "vitest";

import { generateSchedule } from "@/lib/schedule-engine";
import { Acolyte } from "@/types/schedule";

const acolytes: Acolyte[] = [
  { id: "1", name: "Maria Anália", active: true, vacation_only: false },
  { id: "2", name: "Evandro", active: true, vacation_only: false },
  { id: "3", name: "Allana", active: true, vacation_only: false },
  { id: "4", name: "Fernanda", active: true, vacation_only: false },
  { id: "5", name: "Gustavo Dellatorre", active: true, vacation_only: false },
  { id: "6", name: "Yara", active: true, vacation_only: false },
  { id: "7", name: "Giovana", active: true, vacation_only: false },
  { id: "8", name: "Paulo Ricardo", active: true, vacation_only: false },
];

describe("generateSchedule", () => {
  it("schedules Agisse on the second and fourth Saturdays of the month", () => {
    const schedule = generateSchedule(2026, 6, acolytes, []);
    const saturdaySection = schedule.sections.find(
      (section) => section.title === "Sábados",
    );

    const agisseDates = saturdaySection?.entries
      .filter((entry) => entry.location.includes("Agissê"))
      .map((entry) => entry.date);

    expect(agisseDates).toEqual(["2026-06-13", "2026-06-27"]);
  });
});
