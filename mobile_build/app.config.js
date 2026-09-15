import "dotenv/config";

export default {
  expo: {
    name: "PIAT Attendance",
    slug: "piat-attendance-mobile",
    scheme: "piatattendance",
    version: "1.0.0",
    platforms: ["ios", "android", "web"],
    extra: {
      API_BASE: process.env.EXPO_PUBLIC_API_BASE || process.env.API_BASE || "http://localhost:4000",
    },
  },
};
