import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AUTH_KEY = "piat_mobile_auth";

export interface AuthData {
  token: string;
  user: {
    id: string;
    role: string;
    email: string;
    firstName?: string;
    lastName?: string;
    program?: string;
    yearLevel?: string;
    semester?: string;
    academicYear?: string;
    studentId?: string;
  };
}

const isWeb = Platform.OS === "web";

function getWebStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export async function saveAuthData(authData: AuthData): Promise<void> {
  if (isWeb) {
    getWebStorage()?.setItem(AUTH_KEY, JSON.stringify(authData));
    return;
  }
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(authData), {
    keychainService: "piat-mobile",
  });
}

export async function getAuthData(): Promise<AuthData | null> {
  const stored = isWeb
    ? getWebStorage()?.getItem(AUTH_KEY)
    : await SecureStore.getItemAsync(AUTH_KEY, { keychainService: "piat-mobile" });
  return stored ? (JSON.parse(stored) as AuthData) : null;
}

export async function getAuthToken(): Promise<string | null> {
  const authData = await getAuthData();
  return authData?.token ?? null;
}

export async function deleteAuthData(): Promise<void> {
  if (isWeb) {
    getWebStorage()?.removeItem(AUTH_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(AUTH_KEY, {
    keychainService: "piat-mobile",
  });
}