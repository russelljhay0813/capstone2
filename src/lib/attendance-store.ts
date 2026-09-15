import { useCallback, useEffect, useState } from "react";
import { fetchAttendanceRecords, saveAttendance, type AttendanceRecord } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const EVENT = "bwest:attendance-changed";

function broadcastUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT));
}

let eventSource: EventSource | null = null;

function ensureAttendanceEventSource() {
  if (typeof window === "undefined") return;
  if (!eventSource) {
    eventSource = new EventSource(`${API_BASE}/api/events/attendance`);
    eventSource.onmessage = () => {
      window.dispatchEvent(new CustomEvent(EVENT));
    };
    eventSource.onerror = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }
}

export async function getAttendance(offeringId: string, date: string): Promise<AttendanceRecord[]> {
  return fetchAttendanceRecords({ offeringId, date });
}

export async function saveAttendanceRecord(
  studentId: string,        // human-readable
  subjectOfferingId: string,
  date: string,
  status: "present" | "absent" | "late" | "excused",
  time?: string,
): Promise<AttendanceRecord> {
  const record = await saveAttendance({ studentId, subjectOfferingId, date, status, time });
  broadcastUpdate();
  return record;
}

export function useAttendance(offeringId: string, date: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const refresh = useCallback(async () => {
    if (!offeringId || !date) {
      setRecords([]);
      return;
    }
    try {
      setRecords(await getAttendance(offeringId, date));
    } catch {
      setRecords([]);
    }
  }, [offeringId, date]);

  useEffect(() => {
    ensureAttendanceEventSource();
    refresh();
    const onChange = () => refresh();
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  return records;
}