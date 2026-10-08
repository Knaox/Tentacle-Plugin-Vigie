/*
 * Une VRAIE base SQLite pour les tests (`node:sqlite`, intégré à Node 22).
 * Réservé aux tests : jamais importé par le serveur livré.
 */

type Statement = {
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { changes: number | bigint };
};
export type TestDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
};

export function openTestDatabase(path = ":memory:"): TestDatabase {
  // Lu à l'exécution : le module n'existe qu'avec le préfixe `node:`.
  const { DatabaseSync } = (process as unknown as { getBuiltinModule(id: string): unknown })
    .getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => TestDatabase };
  return new DatabaseSync(path);
}

/** Les valeurs que `node:sqlite` sait lier. */
export function bindable(params: unknown[], date: (d: Date) => unknown): unknown[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value instanceof Date) return date(value);
    return value;
  });
}
