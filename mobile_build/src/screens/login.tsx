import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper";
import { useRouter } from "expo-router";
import { fetchFacultyOfferings, fetchOfferingStudents, loginUser } from "../lib/api";
import { saveAuthData } from "../lib/storage";
import { initDb, upsertFaculty, upsertOfferingStudents, upsertOfferings, upsertStudents } from "../lib/db";
import { useToastStore } from "../lib/toast-store";
import { colors } from "../components/MobileShell";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useToastStore((state) => state.showToast);

  const handleLogin = async () => {
    setError(null); setLoading(true);
    try {
      await initDb();
      const authData = await loginUser({ email: email.trim(), password });
      if (authData.role !== "faculty") throw new Error("Only faculty accounts can access this application.");
      await saveAuthData({ token: authData.token, user: authData });
      await upsertFaculty({ id: authData.id, email: authData.email, firstName: authData.firstName, lastName: authData.lastName, role: authData.role, program: authData.program ?? null, yearLevel: authData.yearLevel ?? null, semester: authData.semester ?? null, academicYear: authData.academicYear ?? null });
      const offerings = await fetchFacultyOfferings();
      await upsertOfferings(offerings.map((offering) => ({ ...offering, facultyId: authData.id })));
      for (const offering of offerings) {
        const students = await fetchOfferingStudents(offering.id);
        await upsertStudents(students.map((student: any) => ({ ...student, program: student.program ?? null, yearLevel: student.yearLevel ?? null, semester: student.semester ?? null, academicYear: student.academicYear ?? null })));
        await upsertOfferingStudents(offering.id, students.map((student: any) => student.studentId));
      }
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in. Please check your credentials.";
      const safeMessage = message.includes("backend") || message.includes("reach") ? "Unable to connect to PIAT. Check your connection and try again." : message;
      setError(safeMessage); showToast(safeMessage, "error");
    } finally { setLoading(false); }
  };

  return <View style={styles.container}><View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>PIAT</Text></View><Text style={styles.title}>Faculty Attendance</Text><Text style={styles.subtitle}>Secure attendance tracking for faculty members</Text></View><View style={styles.form}><TextInput mode="outlined" label="Email or username" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={styles.input} outlineColor={colors.line} activeOutlineColor={colors.teal} /><TextInput mode="outlined" label="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} style={styles.input} outlineColor={colors.line} activeOutlineColor={colors.teal} right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword((visible) => !visible)} />} />{error ? <Text style={styles.error}>{error}</Text> : null}<Button mode="contained" buttonColor={colors.teal} contentStyle={styles.buttonContent} onPress={handleLogin} disabled={loading || !email.trim() || !password}>{loading ? "Signing in..." : "Sign in"}</Button>{loading ? <ActivityIndicator color={colors.teal} style={styles.loader} /> : null}</View><Text style={styles.footer}>PIAT School Management System · Faculty access only</Text></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.canvas, padding: 24, justifyContent: "center" }, brand: { alignItems: "center", marginBottom: 36 }, logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", marginBottom: 18 }, logoText: { color: colors.white, fontWeight: "900", fontSize: 20, letterSpacing: 1 }, title: { color: colors.ink, fontWeight: "900", fontSize: 27 }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }, form: { gap: 14 }, input: { backgroundColor: colors.white }, buttonContent: { height: 52 }, error: { color: colors.red, backgroundColor: "#FDECEC", padding: 12, borderRadius: 9, fontSize: 13 }, loader: { marginTop: 2 }, footer: { position: "absolute", bottom: 24, left: 24, right: 24, color: colors.muted, textAlign: "center", fontSize: 11 } });
