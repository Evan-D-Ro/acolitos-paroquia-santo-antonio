export interface Acolyte {
  id: string;
  name: string;
  active: boolean;
  vacation_only: boolean;
}

export interface MassSlot {
  location: string;
  time: string;
  requiredAcolytes: number;
}

export interface ScheduleEntry {
  date: string; // ISO date
  dayOfWeek: number; // 0=Sun, 6=Sat
  location: string;
  time: string;
  acolytes: string[]; // acolyte IDs
  acolyteNames?: string[];
}

export interface ScheduleSection {
  title: string;
  entries: ScheduleEntry[];
}

export interface ScheduleData {
  sections: ScheduleSection[];
}

export interface VariableRule {
  id: string;
  acolyte_id: string;
  rule_type: "unavailable_date" | "max_assignments" | "custom";
  rule_data: {
    dates?: string[];
    max?: number;
    description?: string;
  };
}

export interface RuleViolation {
  type: "error" | "warning";
  message: string;
  entry?: ScheduleEntry;
}

// Mass configuration
export const SUNDAY_MASSES: MassSlot[] = [
  { location: "Salão Paroquial", time: "7h", requiredAcolytes: 2 },
  { location: "Salão Paroquial", time: "9h30", requiredAcolytes: 2 },
  { location: `Santa Tereza d'Ávila`, time: "7h30", requiredAcolytes: 2 },
  { location: "N. Sra. de Fátima", time: "18h", requiredAcolytes: 2 },
  { location: "Salão Paroquial", time: "19h", requiredAcolytes: 2 },
];

export const SATURDAY_MASSES: MassSlot[] = [
  { location: "São Judas Tadeu", time: "18h", requiredAcolytes: 2 },
  { location: "Santa Teresinha", time: "19h30", requiredAcolytes: 1 },
];

export const SATURDAY_BIWEEKLY_MASS: MassSlot = {
  location: "São Sebastião/Agissê",
  time: "19h30",
  requiredAcolytes: 1,
};

export const SATURDAY_HOSPITAL_MASS: MassSlot = {
  location: "Capela do Hospital",
  time: "7h",
  requiredAcolytes: 1,
};

export const WEEKDAY_MASSES: {
  day: string;
  dayOfWeek: number;
  slot: MassSlot;
}[] = [
  {
    day: "Terça",
    dayOfWeek: 2,
    slot: { location: "Salão Paroquial", time: "19h", requiredAcolytes: 1 },
  },
  {
    day: "Quarta",
    dayOfWeek: 3,
    slot: { location: "Salão Paroquial", time: "19h", requiredAcolytes: 1 },
  },
];

export const FIRST_FRIDAY_MASS: MassSlot = {
  location: "Salão Paroquial",
  time: "15h",
  requiredAcolytes: 1,
};

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
