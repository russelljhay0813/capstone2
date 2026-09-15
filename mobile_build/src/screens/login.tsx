import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Button, TextInput, Text, Title } from "react-native-paper";
import { useRouter } from "expo-router";
import {
  loginUser,
  fetchFacultyOfferings,
  fetchOfferingStudents,
} from "../../src/lib/api";
import { saveAuthData } from "../../src/lib/storage";
import {
  initDb,
  upsertFaculty,
  upsertOfferings,
  upsertStudents,
  upsertOfferingStudents,
} from "../../src/lib/db";
import { useToastStore } from "../../src/lib/toast-store";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showToast = useToastStore((state) => state.showToast);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await initDb();
      const authData = await loginUser({ email, password });
      if (authData.role !== "faculty") {
        throw new Error("This mobile app is restricted to faculty accounts.");
      }
      await saveAuthData({ token: authData.token, user: authData });
      await upsertFaculty({
        id: authData.id,
        email: authData.email,
        firstName: authData.firstName,
        lastName: authData.lastName,
        role: authData.role,
        program: authData.program ?? null,
        yearLevel: authData.yearLevel ?? null,
        semester: authData.semester ?? null,
        academicYear: authData.academicYear ?? null,
      });

      const offerings = await fetchFacultyOfferings(authData.id);
      await upsertOfferings(offerings);

      for (const offering of offerings) {
        const students = await fetchOfferingStudents(offering.id);
        await upsertStudents(
          students.map((student: any) => ({
            id: student.id,
            studentId: student.studentId,
            firstName: student.firstName,
            lastName: student.lastName,
            program: student.program ?? null,
            yearLevel: student.yearLevel ?? null,
            semester: student.semester ?? null,
            academicYear: student.academicYear ?? null,
          })),
        );
        await upsertOfferingStudents(
          offering.id,
          students.map((student: any) => student.studentId),
        );
      }

      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Title style={styles.title}>PIAT Attendance</Title>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading || !email || !password}
        >
          Sign In
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16, backgroundColor: "#fff" },
  form: { gap: 16 },
  title: { textAlign: "center", marginBottom: 16 },
  input: { backgroundColor: "transparent" },
  error: { color: "red", textAlign: "center" },
});