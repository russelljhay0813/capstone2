import { createNotification } from "@/lib/notifications-store";

/**
 * Helper functions to trigger notifications for various events
 */

export async function notifyGradePosted(studentId: string, subjectTitle: string): Promise<void> {
  await createNotification(
    studentId,
    "grade",
    "Grade Posted",
    `Your grade for ${subjectTitle} has been posted.`,
    subjectTitle,
  );
}

export async function notifyScheduleChange(
  studentId: string,
  subjectTitle: string,
  changeDetails: string,
): Promise<void> {
  await createNotification(
    studentId,
    "schedule",
    "Schedule Changed",
    `${subjectTitle}: ${changeDetails}`,
    subjectTitle,
  );
}
