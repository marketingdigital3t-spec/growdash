import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

export type ApptStatus = "confirmado" | "aguardando" | "realizado" | "cancelado";
export type ApptColor = "purple" | "pink" | "green" | "yellow";

export type Appointment = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  duration: number; // in hours
  patient: string;
  prof: string;
  proc: string;
  status: ApptStatus;
  value: number;
  color: ApptColor;
};

export type EventKind = "agendamento" | "bloqueio" | "lembrete" | "evento";

export type ClinicEvent = {
  id: string;
  kind: EventKind;
  title: string;
  date: string; // YYYY-MM-DD or "YYYY-MM-DD → YYYY-MM-DD"
  time: string; // HH:MM or "Dia todo"
  who?: string;
  note?: string;
};

type Ctx = {
  appointments: Appointment[];
  events: ClinicEvent[];
  addAppointment: (a: Omit<Appointment, "id">) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
  addEvent: (e: Omit<ClinicEvent, "id">) => void;
  removeEvent: (id: string) => void;
};

const KEY_A = "clinicnext.appointments";
const KEY_E = "clinicnext.events";

const ClinicContext = createContext<Ctx | null>(null);

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>(() => load<Appointment>(KEY_A));
  const [events, setEvents] = useState<ClinicEvent[]>(() => load<ClinicEvent>(KEY_E));

  useEffect(() => {
    localStorage.setItem(KEY_A, JSON.stringify(appointments));
  }, [appointments]);
  useEffect(() => {
    localStorage.setItem(KEY_E, JSON.stringify(events));
  }, [events]);

  const addAppointment = useCallback((a: Omit<Appointment, "id">) => {
    setAppointments((prev) => [...prev, { ...a, id: `AG-${uid()}` }]);
  }, []);
  const updateAppointment = useCallback((id: string, patch: Partial<Appointment>) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);
  const removeAppointment = useCallback((id: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const addEvent = useCallback((e: Omit<ClinicEvent, "id">) => {
    setEvents((prev) => [...prev, { ...e, id: `E-${uid()}` }]);
  }, []);
  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <ClinicContext.Provider
      value={{ appointments, events, addAppointment, updateAppointment, removeAppointment, addEvent, removeEvent }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const ctx = useContext(ClinicContext);
  if (!ctx) throw new Error("useClinic must be used within ClinicProvider");
  return ctx;
}

// helpers
export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateBR(iso: string) {
  if (iso.includes("→")) {
    const [a, b] = iso.split("→").map((s) => s.trim());
    return `${formatDateBR(a)} → ${formatDateBR(b)}`;
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function weekRange(offset: number) {
  const base = new Date();
  base.setDate(base.getDate() + offset * 7);
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

export function isoFromDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
