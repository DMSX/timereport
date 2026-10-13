import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".\\tests\\ui",
  fullyParallel: true,
  use: { baseURL: "http://localhost:3190", browserName: "chromium" },
  webServer: {
    command: "npm run dev -- --port 3190",
    url: "http://localhost:3190",
    reuseExistingServer: false,
    env: {
      NEXT_UI_TEST: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://ui-fixture.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ui-test-publishable-key",
      CRON_SECRET: "isolated-ui-scheduler-test",
    },
  },
});
