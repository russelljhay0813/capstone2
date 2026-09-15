import * as SecureStore from "expo-secure-store";

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

export async function saveAuthData(authData: AuthData): Promise<void> {
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(authData), {
    keychainService: "piat-mobile",
  });
}

export async function getAuthData(): Promise<AuthData | null> {
  const stored = await SecureStore.getItemAsync(AUTH_KEY, {
    keychainService: "piat-mobile",
  });
  return stored ? (JSON.parse(stored) as AuthData) : null;
}

export async function getAuthToken(): Promise<string | null> {
  const authData = await getAuthData();
  return authData?.token ?? null;
}

export async function deleteAuthData(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_KEY, {
    keychainService: "piat-mobile",
  });
}