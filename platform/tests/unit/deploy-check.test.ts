import { describe, expect, it } from "vitest";
import { deployProblems, publicUrl } from "../../src/lib/deploy-check";

const good = { DATABASE_URL: "postgresql://user:pw@ep-example.eu-central-1.aws.neon.tech/neondb?sslmode=require", BETTER_AUTH_SECRET: "k".repeat(44) };

describe("checks before going live", () => {
  it("passes with a real database and a long secret", () => {
    expect(deployProblems(good)).toEqual([]);
    expect(deployProblems({ ...good, BETTER_AUTH_URL: "https://learn.example.org" })).toEqual([]);
  });
  it("needs a database that is not this computer", () => {
    expect(deployProblems({ ...good, DATABASE_URL: undefined })[0]).toMatch(/DATABASE_URL is not set/);
    expect(deployProblems({ ...good, DATABASE_URL: "mysql://x" })[0]).toMatch(/must start with postgresql/);
    expect(deployProblems({ ...good, DATABASE_URL: "postgresql://time:time@localhost:5432/time_dev" })[0]).toMatch(/localhost/);
  });
  it("refuses a missing, example or short secret", () => {
    expect(deployProblems({ ...good, BETTER_AUTH_SECRET: undefined })[0]).toMatch(/not set/);
    expect(deployProblems({ ...good, BETTER_AUTH_SECRET: "change-me" })[0]).toMatch(/example value/);
    expect(deployProblems({ ...good, BETTER_AUTH_SECRET: "short-secret" })[0]).toMatch(/too short/);
  });
  it("needs https for an address set by hand", () => {
    expect(deployProblems({ ...good, BETTER_AUTH_URL: "http://learn.example.org" })[0]).toMatch(/https/);
  });
  it("reports every problem at once", () => {
    expect(deployProblems({})).toHaveLength(2);
  });
});

describe("the platform's public address", () => {
  it("prefers the address set by hand", () => {
    expect(publicUrl({ BETTER_AUTH_URL: "https://learn.example.org", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://learn.example.org");
  });
  it("otherwise uses the live address the host reports", () => {
    expect(publicUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "time-learning.vercel.app" })).toBe("https://time-learning.vercel.app");
  });
  it("is left to the request on previews and on a developer's computer", () => {
    expect(publicUrl({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "time-learning.vercel.app" })).toBeUndefined();
    expect(publicUrl({})).toBeUndefined();
  });
});
