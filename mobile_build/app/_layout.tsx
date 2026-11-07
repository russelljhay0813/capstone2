// _layout.tsx – Root layout for Expo Router (mobile app)
import { useEffect } from "react";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider, Snackbar } from "react-native-paper";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { initDb } from "../src/lib/db";
import { useSyncStore } from "../src/lib/sync-store";
import { useToastStore } from "../src/lib/toast-store";

const queryClient = new QueryClient();

export default function Layout() {
  const sync = useSyncStore();
  const { visible, message, hideToast } = useToastStore();

  useEffect(() => {
    let active = true;
    let stopSync: (() => void) | undefined;
    initDb()
      .then(() => {
        const cleanup = sync.init();
        if (active) stopSync = cleanup;
        else cleanup();
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        useToastStore.getState().showToast(`Unable to initialize local attendance storage: ${message}`, "error");
      });
    return () => {
      active = false;
      stopSync?.();
    };
  }, [sync.init]);

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <QueryClientProvider client={queryClient}>
          <Slot />
          <Snackbar
            visible={visible}
            onDismiss={hideToast}
            duration={3000}
            action={{
              label: "Dismiss",
              onPress: hideToast,
            }}
          >
            {message}
          </Snackbar>
        </QueryClientProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}