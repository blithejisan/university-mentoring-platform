import { defineConfig } from "@prisma/config";

export default defineConfig({
  migrations: {
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:jisan223344@127.0.0.1:5432/mentor_db?schema=public",
  },
});
