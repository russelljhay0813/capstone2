import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Button, Card, Text, TextInput } from "react-native-paper";
import { getOfferingById, getOfferingRoster, saveAttendanceRecord } from "../lib/db";
import { useSyncStore } from "../lib/sync-store";
import { useToastStore } from "../lib/toast-store";
import { generateId } from "../lib/utils";
import { colors, ConnectionPill } from "../components/MobileShell";

const statuses = [
  { value: "present", label: "Present", color: colors.green, background: "#EAF6EC" },
  { value: "late", label: "Late", color: colors.amber, background: "#FFF4E5" },
  { value: "absent", label: "Absent", color: colors.red, background: "#FDECEC" },
  { value: "excused", label: "Excused", color: colors.teal, background: colors.tealSoft },
];

type Student = Record<string, any>;

export default function SubjectAttendanceScreen({ offeringId }: { offeringId: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<Record<string, string>>({});
  const [offering, setOffering] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const sync = useSyncStore();
  const toast = useToastStore((state) => state.showToast);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!offeringId) return;
    Promise.all([getOfferingById(offeringId), getOfferingRoster(offeringId, today)])
      .then(([offeringData, roster]) => {
        setOffering(offeringData);
        setStudents(roster);
        const initial: Record<string, string> = {};
        roster.forEach((row: Student) => {
          if (row.attendanceStatus) initial[row.studentId] = row.attendanceStatus;
        });
        setSelectedStatus(initial);
      })
      .finally(() => setLoading(false));
  }, [offeringId, today]);

  const filteredStudents = useMemo(() => {
    const needle = search.toLowerCase();
    return students.filter((student) => !needle || `${student.firstName} ${student.lastName} ${student.studentId}`.toLowerCase().includes(needle));
  }, [search, students]);

  const summary = useMemo(() => students.reduce((result, student) => {
    const status = selectedStatus[student.studentId] ?? student.attendanceStatus;
    if (status) result[status] = (result[status] ?? 0) + 1;
    return result;
  }, { present: 0, late: 0, absent: 0, excused: 0 } as Record<string, number>), [selectedStatus, students]);

  const saveStatus = async (student: Student, status: string) => {
    if (!offering) return;
    await saveAttendanceRecord({
      id: generateId(), studentId: student.studentId, studentName: `${student.lastName}, ${student.firstName}`,
      offeringId, subjectCode: offering.subjectCode ?? "", subjectName: offering.subjectTitle ?? "",
      facultyId: offering.facultyId ?? "", date: today, time: new Date().toISOString(),
      academicYear: offering.academicYearCode ?? "", semester: offering.semesterName ?? "",
      status, syncStatus: "pending", updatedAt: Date.now(),
    });
    setSelectedStatus((previous) => ({ ...previous, [student.studentId]: status }));
    sync.refreshPendingCount();
  };

  const markAllPresent = async () => {
    await Promise.all(students.map((student) => saveStatus(student, "present")));
    toast(`${students.length} students marked present.`, "success");
  };

  const handleSave = async () => {
    await sync.syncPendingAttendance();
    toast(sync.isConnected ? "Attendance saved and synchronized." : "Attendance saved locally. It will sync when online.", "success");
  };

  const renderStudent = ({ item }: { item: Student }) => {
    const current = selectedStatus[item.studentId] ?? item.attendanceStatus;
    const currentOption = statuses.find((status) => status.value === current);
    return (
      <Card style={styles.student}>
        <Card.Content>
          <View style={styles.studentHead}>
            <View style={styles.flex}>
              <Text style={styles.studentName}>{item.lastName}, {item.firstName}</Text>
              <Text style={styles.caption}>{item.studentId} · {offering?.sectionName ?? "Section"}</Text>
            </View>
            <Text style={[styles.current, { color: currentOption?.color ?? colors.muted }]}>{current ? current.toUpperCase() : "NOT MARKED"}</Text>
          </View>
          <View style={styles.statuses}>
            {statuses.map((status) => (
              <Pressable key={status.value} onPress={() => saveStatus(item, status.value)} style={[styles.statusButton, { backgroundColor: current === status.value ? status.background : colors.canvas, borderColor: current === status.value ? status.color : colors.line }]}>
                <Text style={[styles.statusText, { color: current === status.value ? status.color : colors.muted }]}>{status.label}</Text>
              </Pressable>
            ))}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}><View style={styles.flex}><Text style={styles.eyebrow}>TAKE ATTENDANCE</Text><Text style={styles.title}>{offering?.subjectCode ?? "Attendance"}</Text><Text style={styles.subtitle}>{offering?.subjectTitle ?? "Loading class details"}</Text><Text style={styles.meta}>{offering?.sectionName ?? "Section"} · {offering?.schedule ?? "Schedule"} · {offering?.room ?? "Room"}</Text></View><ConnectionPill /></View>
      <Card style={styles.summary}><Card.Content><View style={styles.summaryTop}><View><Text style={styles.summaryTitle}>{today}</Text><Text style={styles.caption}>{students.length} students enrolled</Text></View><Button mode="contained" compact buttonColor={colors.teal} onPress={markAllPresent} disabled={!students.length}>Mark all present</Button></View><View style={styles.counts}>{statuses.map((status) => <View key={status.value} style={styles.count}><Text style={[styles.countNumber, { color: status.color }]}>{summary[status.value] ?? 0}</Text><Text style={styles.caption}>{status.label}</Text></View>)}</View></Card.Content></Card>
      <TextInput mode="outlined" dense placeholder="Search by student name or ID" value={search} onChangeText={setSearch} style={styles.search} outlineColor={colors.line} activeOutlineColor={colors.teal} />
      {loading ? <Text style={styles.loading}>Loading roster...</Text> : <FlatList data={filteredStudents} keyExtractor={(item) => item.studentId} renderItem={renderStudent} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>No enrolled students found.</Text>} />}
      <Button mode="contained" buttonColor={colors.teal} onPress={handleSave} loading={sync.isSyncing} style={styles.save}>Save attendance</Button>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.canvas, padding: 16 }, header: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 14 }, flex: { flex: 1 }, eyebrow: { color: colors.teal, fontWeight: "800", fontSize: 10, letterSpacing: 1 }, title: { color: colors.ink, fontWeight: "900", fontSize: 23, marginTop: 3 }, subtitle: { color: colors.ink, fontWeight: "600", marginTop: 3 }, meta: { color: colors.muted, fontSize: 12, marginTop: 5 }, summary: { backgroundColor: colors.white, borderRadius: 14, marginBottom: 12 }, summaryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, summaryTitle: { color: colors.ink, fontWeight: "800" }, caption: { color: colors.muted, fontSize: 12 }, counts: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 }, count: { alignItems: "center" }, countNumber: { fontSize: 22, fontWeight: "900" }, search: { backgroundColor: colors.white, marginBottom: 12 }, list: { gap: 10, paddingBottom: 88 }, student: { backgroundColor: colors.white, borderRadius: 14 }, studentHead: { flexDirection: "row", gap: 8, alignItems: "flex-start" }, studentName: { color: colors.ink, fontSize: 15, fontWeight: "800" }, current: { fontSize: 9, fontWeight: "900" }, statuses: { flexDirection: "row", gap: 6, marginTop: 13 }, statusButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" }, statusText: { fontSize: 10, fontWeight: "800" }, loading: { color: colors.muted, textAlign: "center", marginTop: 20 }, empty: { color: colors.muted, textAlign: "center", marginTop: 30 }, save: { position: "absolute", left: 16, right: 16, bottom: 16 } });
