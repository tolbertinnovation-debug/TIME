import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Table changes use DIRECT_URL when it is set (a database's direct, non-pooled address), otherwise DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL || "" },
});
