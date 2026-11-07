import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { getAuthData } from "../lib/storage";
import { getTodayOfferings, getTotalStudentsForFaculty } from "../lib/db";
import { colors, MobileShell, SectionLabel } from "../components/MobileShell";
import { useSyncStore } from "../lib/sync-store";

export default function DashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const sync = useSyncStore();

  useEffect(() => {
    getAuthData()
      .then(async (auth) => {
        setProfile(auth?.user);
        if (auth?.user?.id) {
          setOfferings(await getTodayOfferings(auth.user.id));
          setStudentCount(await getTotalStudentsForFaculty(auth.user.id));
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        useSyncStore.setState({ error: `Unable to load cached faculty data: ${message}` });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell
      title="Dashboard"
      subtitle={`Good morning, ${profile?.firstName ?? "Faculty"}`}
    >
      <View style={styles.welcome}>
        <Text style={styles.welcomeTitle}>Student Attendance</Text>
        <Text style={styles.caption}>
          Keep attendance accurate, even when you are offline.
        </Text>
      </View>
      <View style={styles.stats}>
        <Stat label="Assigned subjects" value={offerings.length} />
        <Stat label="Students" value={studentCount} />
        <Stat label="Pending sync" value={sync.pendingCount} />
      </View>
      <Card style={styles.syncCard}>
        <Card.Content>
          <View style={styles.syncRow}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>
                {sync.isConnected ? "Internet available" : "Offline mode active"}
              </Text>
              <Text style={styles.caption}>
                {sync.isConnected
                  ? "Records sync after the backend confirms storage."
                  : "Attendance is saved locally until internet returns."}
              </Text>
            </View>
            <Text
              style={[
                styles.syncStatus,
                { color: sync.isConnected ? colors.green : colors.amber },
              ]}
            >
              {sync.isConnected ? "ONLINE" : "OFFLINE"}
            </Text>
          </View>
          <View style={styles.syncCounts}>
            <Text style={styles.caption}>Synced: {sync.syncedCount}</Text>
            <Text style={styles.caption}>Failed: {sync.failedCount}</Text>
          </View>
          {sync.lastSyncAt ? (
            <Text style={styles.caption}>
              Last successful sync: {new Date(sync.lastSyncAt).toLocaleString()}
            </Text>
          ) : (
            <Text style={styles.caption}>No successful sync recorded yet.</Text>
          )}
          {sync.progress ? (
            <Text style={styles.progress}>
              Synchronizing {sync.progress.completed} of {sync.progress.total} records...
            </Text>
          ) : null}
          {sync.error ? <Text style={styles.error}>{sync.error}</Text> : null}
          {sync.pendingCount > 0 || sync.retryableFailedCount > 0 ? (
            <Button
              mode="text"
              compact
              textColor={colors.teal}
              onPress={() => void sync.retryFailedAttendance()}
              loading={sync.isSyncing}
              disabled={sync.isSyncing || !sync.isConnected}
            >
              Retry / sync attendance
            </Button>
          ) : null}
        </Card.Content>
      </Card>
      <SectionLabel>Today’s classes</SectionLabel>
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : offerings.length === 0 ? (
        <Card style={styles.empty}>
          <Card.Content>
            <Text style={styles.cardTitle}>No classes scheduled today.</Text>
            <Text style={styles.caption}>
              Your assigned subjects are still available from Subjects.
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <FlatList
          data={offerings}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.classCard}>
              <Card.Content>
                <View style={styles.row}>
                  <View style={styles.code}>
                    <Text style={styles.codeText}>{item.subjectCode}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.subject}>{item.subjectTitle}</Text>
                    <Text style={styles.caption}>
                      {item.sectionName ?? "Section"} · {item.schedule ?? "Schedule"}
                    </Text>
                  </View>
                </View>
                <View style={styles.details}>
                  <Text style={styles.caption}>{item.room ?? "Room to be announced"}</Text>
                  <Text style={styles.caption}>
                    {item.enrolledStudentCount ?? 0} students
                  </Text>
                </View>
                <Button
                  mode="contained"
                  buttonColor={colors.teal}
                  onPress={() => router.push(`/attendance/${item.id}`)}
                >
                  Take attendance
                </Button>
              </Card.Content>
            </Card>
          )}
        />
      )}
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.stat}>
      <Card.Content>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  welcome: { marginBottom: 16 },
  welcomeTitle: { color: colors.ink, fontWeight: "800", fontSize: 20, marginBottom: 4 },
  caption: { color: colors.muted, fontSize: 13 },
  stats: { flexDirection: "row", gap: 8, marginBottom: 14 },
  stat: { flex: 1, borderRadius: 13, backgroundColor: colors.white },
  statValue: { color: colors.teal, fontSize: 22, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  syncCard: { borderRadius: 14, backgroundColor: colors.white, marginBottom: 20 },
  syncRow: { flexDirection: "row", alignItems: "center" },
  syncCounts: { flexDirection: "row", justifyContent: "space-between", marginVertical: 8 },
  flex: { flex: 1 },
  cardTitle: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  syncStatus: { fontSize: 10, fontWeight: "800" },
  progress: { color: colors.teal, fontSize: 12, marginTop: 6 },
  error: { color: colors.red, fontSize: 12, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  code: { backgroundColor: colors.tealSoft, borderRadius: 10, padding: 9 },
  codeText: { color: colors.teal, fontWeight: "800", fontSize: 12 },
  subject: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  details: { flexDirection: "row", justifyContent: "space-between", marginVertical: 14 },
  list: { gap: 12, paddingBottom: 20 },
  classCard: { borderRadius: 14, backgroundColor: colors.white },
  empty: { borderRadius: 14, backgroundColor: colors.white },
});
