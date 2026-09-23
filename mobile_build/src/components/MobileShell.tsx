import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { usePathname, useRouter } from "expo-router";
import { useSyncStore } from "../lib/sync-store";

export const colors = {
  ink: "#18324B",
  muted: "#6B7C8F",
  teal: "#087E8B",
  tealSoft: "#E5F4F5",
  canvas: "#F5F8FA",
  line: "#DCE5EA",
  white: "#FFFFFF",
  green: "#218739",
  amber: "#B66A00",
  red: "#B42318",
};

const tabs = [
  { label: "Dashboard", route: "/dashboard" },
  { label: "Subjects", route: "/subjects" },
  { label: "Attendance", route: "/history" },
  { label: "Profile", route: "/profile" },
];

export function ConnectionPill() {
  const { isConnected, pendingCount } = useSyncStore();
  return (
    <View style={[styles.connection, { backgroundColor: isConnected ? "#EAF6EC" : "#FFF4E5" }]}>
      <View style={[styles.dot, { backgroundColor: isConnected ? colors.green : colors.amber }]} />
      <Text style={[styles.connectionText, { color: isConnected ? colors.green : colors.amber }]}>
        {isConnected ? "ONLINE" : "OFFLINE"}
      </Text>
      {pendingCount > 0 ? <Text style={styles.pendingText}>{pendingCount} pending</Text> : null}
    </View>
  );
}

export function MobileShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.brandMark}><Text style={styles.brandText}>PIAT</Text></View>
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <ConnectionPill />
      </View>
      <View style={styles.content}>{children}</View>
      <Surface style={styles.nav} elevation={4}>
        {tabs.map((tab) => {
          const active = pathname === tab.route;
          return (
            <Pressable key={tab.route} onPress={() => router.replace(tab.route)} style={styles.navItem}>
              <View style={[styles.navIcon, active && styles.navIconActive]}><Text style={[styles.navIconText, active && styles.navIconTextActive]}>{tab.label.slice(0, 1)}</Text></View>
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </Surface>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  topBar: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  brandMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  brandText: { color: colors.white, fontWeight: "800", fontSize: 12 },
  heading: { flex: 1 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  subtitle: { color: colors.muted, marginTop: 2, fontSize: 12 },
  content: { flex: 1, padding: 16 },
  connection: { alignItems: "flex-end", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, marginBottom: 3 },
  connectionText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  pendingText: { fontSize: 9, color: colors.muted, marginTop: 2 },
  nav: { flexDirection: "row", paddingBottom: 8, paddingTop: 8, backgroundColor: colors.white },
  navItem: { flex: 1, alignItems: "center", gap: 3 },
  navIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  navIconActive: { backgroundColor: colors.tealSoft },
  navIconText: { color: colors.muted, fontWeight: "800" },
  navIconTextActive: { color: colors.teal },
  navLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  navLabelActive: { color: colors.teal, fontWeight: "800" },
  sectionLabel: { color: colors.ink, fontSize: 15, fontWeight: "800", marginBottom: 10 },
});