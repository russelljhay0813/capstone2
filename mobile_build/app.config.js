import "dotenv/config";

const apiBase =
  process.env.EXPO_PUBLIC_API_BASE || process.env.API_BASE || "http://localhost:4000";

if (process.env.EAS_BUILD_PROFILE && !/^https:\/\//i.test(apiBase)) {
  throw new Error(
    "Set EXPO_PUBLIC_API_BASE to the deployed HTTPS PIAT API URL before creating an EAS build.",
  );
}

export default {
  expo: {
    name: "PIAT Attendance",
    slug: "piat-attendance-mobile",
    scheme: "piatattendance",
    version: "1.0.0",
    icon: "./assets/icon.png",
    platforms: ["ios", "android", "web"],
    android: {
      package: "com.piat.attendance",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    extra: {
      API_BASE: apiBase,
    },
  },
};
