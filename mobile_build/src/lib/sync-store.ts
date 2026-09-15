import { create } from "zustand";
import NetInfo from "@react-native-community/netinfo";
import { getPendingAttendance, updateAttendanceSyncStatus } from "./db";
import { saveAttendanceBulk } from "./api";
import { useToastStore } from "./toast-store";

interface SyncState {
  isConnected: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
  error: string | null;
  init: () => void;
  refreshPendingCount: () => Promise<void>;
  syncPendingAttendance: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isConnected: false,
  pendingCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  error: null,

  init: () => {
    // Initial network check
    NetInfo.fetch().then(async (state) => {
      const connected = state.isConnected && state.isInternetReachable;
      set({ isConnected: !!connected });
      if (connected) await get().syncPendingAttendance();
    });

    // Listen for network changes
    NetInfo.addEventListener(async (state) => {
      const connected = state.isConnected && state.isInternetReachable;
      set({ isConnected: !!connected });
      if (connected) {
        await get().syncPendingAttendance();
      }
    });

    // Initial pending count
    get().refreshPendingCount();
  },

  refreshPendingCount: async () => {
    const pending = await getPendingAttendance();
    set({ pendingCount: pending.length });
  },

  syncPendingAttendance: async () => {
    const pending = await getPendingAttendance();
    if (!pending.length) {
      set({ lastSyncAt: Date.now(), error: null });
      return;
    }

    set({ isSyncing: true, error: null });
    try {
      // Build payload
      const payload = pending.map((record) => ({
        localId: record.id,
        studentId: record.studentId,
        subjectId: record.subjectId,
        date: record.date,
        status: record.status,
      }));

      const results = await saveAttendanceBulk(payload);

      // Update sync status per record
      for (const result of results) {
        const id = result.localId ?? result.id;
        if (!id) continue;
        if (result.status === "created" || result.status === "updated") {
          await updateAttendanceSyncStatus(id, "synced");
        } else {
          await updateAttendanceSyncStatus(id, "failed");
        }
      }

      // Refresh pending count and update last sync time
      await get().refreshPendingCount();
      set({ lastSyncAt: Date.now(), error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: message });
      // Optionally notify user
      useToastStore.getState().showToast(`Sync failed: ${message}`, "error");
    } finally {
      set({ isSyncing: false });
    }
  },
}));