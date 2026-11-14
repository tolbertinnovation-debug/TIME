import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Table changes need the database's direct (non-pooled) address: DIRECT_URL if set by hand, or
  // DATABASE_URL_UNPOOLED as set by Vercel's Neon integration. Otherwise DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "" },
});
