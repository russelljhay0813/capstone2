import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text, TextInput } from "react-native-paper";
import { useFocusEffect } from "expo-router";
import { getAuthData } from "../src/lib/storage";
import { getAttendanceHistory } from "../src/lib/db";
import { colors, MobileShell, SectionLabel } from "../src/components/MobileShell";

type AttendanceGroup = {
  offeringId: string;
  date: string;
  subjectCode: string;
  subjectName: string;
  sectionName?: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  syncStates: Set<string>;
  lastError?: string | null;
};

export default function HistoryScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      getAuthData()
        .then(async (auth) => {
          if (!auth?.user?.id) return;
          const history = await getAttendanceHistory(auth.user.id);
          if (active) setRecords(history);
        })
        .catch((cause: unknown) => {
          const message = cause instanceof Error ? cause.message : String(cause);
          if (active) setError(`Unable to load attendance history: ${message}`);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceGroup>();
    records
      .filter((record) =>
        `${record.subjectCode} ${record.subjectName} ${record.date}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .forEach((record) => {
        const key = `${record.offeringId}:${record.date}`;
        const item = map.get(key) ?? {
          ...record,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          syncStates: new Set<string>(),
        };
        item[record.status as "present" | "late" | "absent" | "excused"] += 1;
        item.syncStates.add(record.syncStatus);
        item.lastError = record.lastError ?? item.lastError;
        map.set(key, item);
      });
    return [...map.values()];
  }, [records, query]);

  return (
    <MobileShell title="Attendance history" subtitle="Review your recorded classes">
      <TextInput
        mode="outlined"
        dense
        value={query}
        onChangeText={setQuery}
        placeholder="Search subject or date"
        style={styles.search}
        outlineColor={colors.line}
        activeOutlineColor={colors.teal}
      />
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : grouped.length === 0 ? (
        <Card style={styles.empty}>
          <Card.Content>
            <Text style={styles.emptyTitle}>No attendance records found.</Text>
            <Text style={styles.caption}>
              Saved attendance will appear here after you record a class.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => `${item.offeringId}:${item.date}`}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const hasFailed = item.syncStates.has("failed");
            const isSyncing = item.syncStates.has("syncing");
            const allSynced =
              item.syncStates.size > 0 &&
              [...item.syncStates].every((status) => status === "synced");
            const syncLabel = hasFailed
              ? "Failed"
              : isSyncing
                ? "Syncing"
                : allSynced
                  ? "Synced"
                  : "Pending";
            return (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.row}>
                    <View style={styles.flex}>
                      <Text style={styles.subject}>
                        {item.subjectCode} · {item.subjectName}
                      </Text>
                      <Text style={styles.caption}>
                        {item.date} · {item.sectionName ?? "Section"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.sync,
                        { color: hasFailed ? colors.red : colors.teal },
                      ]}
                    >
                      {syncLabel}
                    </Text>
                  </View>
                  {hasFailed && item.lastError ? (
                    <Text style={styles.error}>{item.lastError}</Text>
                  ) : null}
                  <SectionLabel>
                    {item.present + item.late + item.absent + item.excused} students
                  </SectionLabel>
                  <View style={styles.counts}>
                    <Text style={styles.present}>Present {item.present}</Text>
                    <Text style={styles.late}>Late {item.late}</Text>
                    <Text style={styles.absent}>Absent {item.absent}</Text>
                    <Text style={styles.excused}>Excused {item.excused}</Text>
                  </View>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  search: { backgroundColor: colors.white, marginBottom: 14 },
  list: { gap: 12, paddingBottom: 20 },
  card: { borderRadius: 14, backgroundColor: colors.white },
  empty: { borderRadius: 14, backgroundColor: colors.white },
  emptyTitle: { color: colors.ink, fontWeight: "700", marginBottom: 5 },
  caption: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  flex: { flex: 1 },
  subject: { color: colors.ink, fontWeight: "800", fontSize: 14, marginBottom: 4 },
  sync: { fontSize: 11, fontWeight: "800" },
  error: { color: colors.red, fontSize: 12, marginVertical: 6 },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  present: { color: colors.green, fontWeight: "700" },
  late: { color: colors.amber, fontWeight: "700" },
  absent: { color: colors.red, fontWeight: "700" },
  excused: { color: colors.teal, fontWeight: "700" },
});
