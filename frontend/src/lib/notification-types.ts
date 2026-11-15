/**
 * Notification System Type Definitions
 *
 * This file provides TypeScript types for the notifications system.
 * It's imported by notifications-store.ts and can be used throughout the app.
 */

/**
 * Supported notification types
 */
export type NotificationType = "grade" | "schedule";

/**
 * Notification object stored in database
 */
export interface Notification {
  /** Unique identifier (UUID) */
  id: string;

  /** User who receives the notification */
  userId: string;

  /** Type of notification */
  type: NotificationType;

  /** Notification title */
  title: string;

  /** Notification message */
  message: string;

  /** Read status (0 = unread, 1 = read) */
  read: boolean;

  /** Timestamp when created */
  createdAt: number;

  /** Optional reference ID (e.g., subject ID) */
  relatedId?: string;
}

/**
 * Request payload for creating a notification
 */
export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
}

/**
 * Response from notifications API
 */
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

/**
 * Hook return type for useNotifications
 */
export interface UseNotificationsReturn {
  /** All notifications for the user */
  notifications: Notification[];

  /** Count of unread notifications */
  unreadCount: number;

  /** Loading state */
  loading: boolean;

  /** Function to mark a notification as read */
  markAsRead: (notificationId: string) => Promise<void>;

  /** Function to clear all notifications */
  clearAll: () => Promise<void>;

  /** Function to manually refresh notifications */
  refresh: () => Promise<void>;
}

/**
 * Helper function type signatures
 */
export interface NotificationTriggers {
  notifyGradePosted: (studentId: string, subjectTitle: string) => Promise<void>;
  notifyScheduleChange: (
    studentId: string,
    subjectTitle: string,
    changeDetails: string,
  ) => Promise<void>;
  createNotification: (
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedId?: string,
  ) => Promise<void>;
}
