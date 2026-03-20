import { Pool } from "pg";

import type { ProductApiConfig } from "./config";
import { runM4Migrations } from "./migrations";
import { InMemoryStore, PostgresStore, type ProductStore } from "./store";

export async function createProductStore(config: ProductApiConfig): Promise<ProductStore> {
  if (config.storeBackend === "memory") {
    return new InMemoryStore();
  }

  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required for postgres store backend");
  }

  if (config.autoMigrate) {
    const migrationPool = new Pool({ connectionString: config.databaseUrl });
    try {
      await runM4Migrations(migrationPool);
    } finally {
      await migrationPool.end();
    }
  }

  return new PostgresStore(config.databaseUrl);
}
