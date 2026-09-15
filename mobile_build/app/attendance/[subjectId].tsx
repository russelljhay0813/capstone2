// attendance.tsx – Subject attendance route (mobile)
import { useLocalSearchParams } from "expo-router";
import SubjectAttendanceScreen from "../../src/screens/attendance";

export default function AttendanceRoute() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  return <SubjectAttendanceScreen subjectId={subjectId} />;
}