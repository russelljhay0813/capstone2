import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Avatar, Button, Card, Text } from "react-native-paper";
import { useRouter } from "expo-router";
import { deleteAuthData, getAuthData } from "../src/lib/storage";
import { getFacultyOfferings } from "../src/lib/db";
import { colors, MobileShell, SectionLabel } from "../src/components/MobileShell";

export default function ProfileScreen() {
  const router = useRouter(); const [user, setUser] = useState<any>(null); const [subjectCount, setSubjectCount] = useState(0);
  useEffect(() => { getAuthData().then((auth) => { setUser(auth?.user); if (auth?.user?.id) getFacultyOfferings(auth.user.id).then((items) => setSubjectCount(items.length)); }); }, []);
  const logout = async () => { await deleteAuthData(); router.replace("/login"); };
  return <MobileShell title="Faculty profile" subtitle="Account and teaching access"><Card style={styles.card}><Card.Content><View style={styles.profile}><Avatar.Text size={62} label={`${user?.firstName?.[0] ?? "F"}${user?.lastName?.[0] ?? ""}`} color={colors.white} style={styles.avatar} /><View><Text style={styles.name}>{user?.firstName ?? "Faculty"} {user?.lastName ?? ""}</Text><Text style={styles.role}>Faculty account</Text></View></View><View style={styles.rule} /><SectionLabel>Account details</SectionLabel><Text style={styles.label}>Faculty ID</Text><Text style={styles.value}>{user?.id ?? "Not available"}</Text><Text style={styles.label}>Email</Text><Text style={styles.value}>{user?.email ?? "Not available"}</Text><Text style={styles.label}>Department / program</Text><Text style={styles.value}>{user?.program ?? "Not available"}</Text><Text style={styles.label}>Assigned subjects</Text><Text style={styles.value}>{subjectCount}</Text></Card.Content></Card><Button mode="outlined" textColor={colors.red} onPress={logout} style={styles.logout}>Log out</Button></MobileShell>;
}
const styles = StyleSheet.create({ card: { borderRadius: 14, backgroundColor: colors.white }, profile: { flexDirection: "row", alignItems: "center", gap: 14 }, avatar: { backgroundColor: colors.teal }, name: { color: colors.ink, fontWeight: "800", fontSize: 19 }, role: { color: colors.muted, marginTop: 3 }, rule: { borderBottomWidth: 1, borderBottomColor: colors.line, marginVertical: 20 }, label: { color: colors.muted, fontSize: 12, marginTop: 13 }, value: { color: colors.ink, fontSize: 15, marginTop: 3 }, logout: { marginTop: 18, borderColor: "#E2B5B1" } });