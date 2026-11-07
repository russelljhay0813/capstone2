import { AppState } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";
import {
  getAttendanceSyncSummary,
  getNextAttendanceRetryAt,
  getPendingAttendance,
  markAttendanceFailed,
  markAttendanceSynced,
  markAttendanceSyncing,
  retryFailedAttendance as requeueFailedAttendance,
} from "./db";
import { ApiError, saveAttendanceBulk } from "./api";
import { useToastStore } from "./toast-store";

type SyncOutcome = "synced" | "offline" | "failed" | "nothing-to-sync" | "already-syncing";

interface SyncState {
  isConnected: boolean;
  pendingCount: number;
  syncingCount: number;
  syncedCount: number;
  failedCount: number;
  retryableFailedCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
  progress: { completed: number; total: number } | null;
  error: string | null;
  init: () => () => void;
  refreshPendingCount: () => Promise<void>;
  syncPendingAttendance: () => Promise<SyncOutcome>;
  retryFailedAttendance: () => Promise<SyncOutcome>;
}

function isConnectedToInternet(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function isPermanentRecordError(message: string): boolean {
  return /invalid|missing|required|forbidden|not authorized|not enrolled|not found|unauthorized/i.test(
    message,
  );
}

function canRetryRequest(status: number | undefined): boolean {
  return status === undefined || status === 408 || status === 425 || status === 429 || status >= 500;
}

let retryTimeout: ReturnType<typeof setTimeout> | null = null;
let syncRequestedDuringRun = false;

function clearRetryTimeout() {
  if (retryTimeout) clearTimeout(retryTimeout);
  retryTimeout = null;
}

async function scheduleEligibleRetry(get: () => SyncState): Promise<void> {
  clearRetryTimeout();
  const retryAt = await getNextAttendanceRetryAt();
  if (retryAt == null) return;
  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    if (get().isConnected) void get().syncPendingAttendance();
  }, Math.max(0, retryAt - Date.now()));
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isConnected: false,
  pendingCount: 0,
  syncingCount: 0,
  syncedCount: 0,
  failedCount: 0,
  retryableFailedCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  progress: null,
  error: null,

  init: () => {
    let active = true;
    const handleNetworkState = async (state: NetInfoState) => {
      const connected = isConnectedToInternet(state);
      set({ isConnected: connected });
      await get().refreshPendingCount();
      if (connected && active) await get().syncPendingAttendance();
    };

    void NetInfo.fetch()
      .then(handleNetworkState)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: `Unable to check network connectivity: ${message}` });
      });

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      void handleNetworkState(state).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: `Unable to process network change: ${message}` });
      });
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void NetInfo.fetch()
        .then(handleNetworkState)
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          set({ error: `Unable to refresh connectivity: ${message}` });
        });
    });

    void get()
      .refreshPendingCount()
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: `Unable to read local attendance status: ${message}` });
      });
    return () => {
      active = false;
      clearRetryTimeout();
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  },

  refreshPendingCount: async () => {
    const summary = await getAttendanceSyncSummary();
    set({
      pendingCount: summary.pendingCount + summary.syncingCount,
      syncingCount: summary.syncingCount,
      syncedCount: summary.syncedCount,
      failedCount: summary.failedCount,
      retryableFailedCount: summary.retryableFailedCount,
      lastSyncAt: summary.lastSyncAt,
    });
  },

  syncPendingAttendance: async () => {
    if (get().isSyncing) {
      syncRequestedDuringRun = true;
      return "already-syncing";
    }
    if (!get().isConnected) return "offline";

    clearRetryTimeout();
    set({ isSyncing: true, error: null });
    let records: Awaited<ReturnType<typeof getPendingAttendance>> = [];
    try {
      records = await getPendingAttendance();
      if (!records.length) return "nothing-to-sync";

      const localIds = records.map((record) => String(record.id));
      await markAttendanceSyncing(localIds);
      set({ progress: { completed: 0, total: records.length } });

      const results = await saveAttendanceBulk(
        records.map((record) => ({
          localId: String(record.id),
          studentId: record.studentId,
          subjectOfferingId: record.offeringId,
          date: record.date,
          status: record.status,
          time: record.time,
        })),
      );
      const resultsById = new Map(
        results
          .filter((result) => result.localId)
          .map((result) => [String(result.localId), result]),
      );
      let failed = 0;

      for (const [index, record] of records.entries()) {
        const localId = String(record.id);
        const result = resultsById.get(localId);
        if (
          result &&
          (result.status === "created" || result.status === "updated") &&
          result.id
        ) {
          await markAttendanceSynced(localId, result.id);
        } else {
          failed += 1;
          const message = result?.error ?? "The server did not confirm this attendance record.";
          await markAttendanceFailed(
            localId,
            message,
            result ? !isPermanentRecordError(message) : true,
          );
        }
        set({ progress: { completed: index + 1, total: records.length } });
      }

      await get().refreshPendingCount();
      if (failed) {
        const message = `${failed} attendance record${failed === 1 ? "" : "s"} could not be synchronized.`;
        set({ error: message });
        useToastStore.getState().showToast(message, "error");
        return "failed";
      }
      return "synced";
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message =
        status === 401
          ? "Authentication expired. Sign in again to synchronize saved attendance."
          : status === 403
            ? "You are no longer authorized to synchronize this attendance. Contact an administrator."
            : error instanceof Error
              ? error.message
              : String(error);
      const retryable = canRetryRequest(status);
      for (const record of records) {
        await markAttendanceFailed(String(record.id), message, retryable);
      }
      set({ error: message });
      useToastStore.getState().showToast(`Sync failed: ${message}`, "error");
      return "failed";
    } finally {
      set({ isSyncing: false, progress: null });
      try {
        await get().refreshPendingCount();
        await scheduleEligibleRetry(get);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        set({ error: `Unable to refresh local attendance status: ${message}` });
      }
      if (syncRequestedDuringRun) {
        syncRequestedDuringRun = false;
        if (get().isConnected) void get().syncPendingAttendance();
      }
    }
  },

  retryFailedAttendance: async () => {
    if (get().isSyncing) return "already-syncing";
    await requeueFailedAttendance();
    await get().refreshPendingCount();
    return get().syncPendingAttendance();
  },
}));
