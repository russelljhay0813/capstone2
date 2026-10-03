import { expect, test, type Page } from "@playwright/test";

const analytics = {
  totalStudents: 191,
  activeFaculty: 17,
  registrars: 2,
  subjectOfferings: 1126,
  studentsByProgram: [
    { program: "Diploma in Hospitality Services and Technology", count: 39 },
    { program: "Diploma in Tourism and Travel Services", count: 38 },
    { program: "Diploma in Multimedia Arts and Design", count: 38 },
    {
      program: "Diploma in Industrial Education (Major in Hotel and Restaurant Services)",
      count: 38,
    },
    {
      program: "Diploma in Industrial Education (Major in Multimedia Arts and Design)",
      count: 38,
    },
    { program: "Unassigned", count: 0 },
  ],
};

async function signInAs(page: Page, role: "admin" | "registrar") {
  await page.route("**/api/notifications**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/dashboard/admin", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalStudents: 191,
        activeFaculty: 17,
        activeOfferings: 1126,
        pendingApplications: 10,
      }),
    }),
  );
  await page.route("**/api/dashboard/registrar", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pendingApplications: 10,
        approvedStudents: 191,
        pendingEnrollments: 0,
        activeStudents: 191,
        totalSubjects: 1126,
        assignedFaculty: 17,
        programsOffered: 5,
        eligibleReenrollment: 0,
        recentActivities: [],
      }),
    }),
  );
  await page.route("**/api/users/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: `e2e-${role}`,
        userId: `e2e-${role}`,
        username: "analytics@example.test",
        email: "analytics@example.test",
        firstName: "Analytics",
        lastName: "Test",
        role,
        status: "active",
        createdAt: Date.now(),
        token: `e2e-${role}-token`,
      }),
    }),
  );

  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByLabel("Username or email address").fill("analytics@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/${role}$`));
}

async function openAnalytics(page: Page) {
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin\/analytics$/);
}

test("administrator sees database-backed analytics and values persist after refresh", async ({
  page,
}) => {
  await signInAs(page, "admin");

  const requests: string[] = [];
  await page.route("**/api/dashboard/analytics", async (route) => {
    requests.push(route.request().headers().authorization ?? "");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(analytics),
    });
  });

  await openAnalytics(page);
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Total Students", { exact: true })).toBeVisible();
  for (const value of ["191", "17", "2", "1126", "39", "0"]) {
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("38", { exact: true })).toHaveCount(4);
  for (const program of analytics.studentsByProgram) {
    await expect(page.getByText(program.program, { exact: true })).toBeVisible();
  }
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((authorization) => authorization === "Bearer e2e-admin-token")).toBe(true);

  const initialRequestCount = requests.length;
  await page.reload();
  await expect(page.getByText("1126", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Diploma in Hospitality Services and Technology", { exact: true }),
  ).toBeVisible();
  expect(requests.length).toBeGreaterThan(initialRequestCount);
  expect(requests.every((authorization) => authorization === "Bearer e2e-admin-token")).toBe(true);
});

test("non-administrator cannot open or fetch analytics directly", async ({ page }) => {
  await signInAs(page, "registrar");

  const analyticsRequests: string[] = [];
  await page.route("**/api/dashboard/analytics", async (route) => {
    analyticsRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(analytics),
    });
  });

  await expect(page.getByRole("link", { name: "Analytics", exact: true })).toHaveCount(0);
  await page.goto("/dashboard/admin/analytics", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toHaveText(
    "Administrator access is required to view analytics.",
  );
  await expect(page.getByText("1126", { exact: true })).toHaveCount(0);
  expect(analyticsRequests).toHaveLength(0);
});

test("analytics API errors are visible rather than replaced with zero values", async ({ page }) => {
  await signInAs(page, "admin");
  await page.route("**/api/dashboard/analytics", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Analytics temporarily unavailable" }),
    }),
  );

  await openAnalytics(page);
  await expect(page.getByRole("alert")).toHaveText(
    "Unable to load analytics: Analytics temporarily unavailable",
  );
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(4);
  await expect(page.getByText("Program distribution is unavailable.")).toBeVisible();
});
