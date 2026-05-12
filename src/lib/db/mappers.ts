function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)
}

// Recursively converts snake_case keys from Supabase to camelCase Drizzle types
export function fromDb<T>(row: unknown): T {
  if (Array.isArray(row)) return row.map(fromDb) as unknown as T
  if (row !== null && typeof row === 'object') {
    return Object.fromEntries(
      Object.entries(row as Record<string, unknown>).map(([k, v]) => [snakeToCamel(k), fromDb(v)])
    ) as T
  }
  return row as T
}

// Recursively converts camelCase Drizzle types to snake_case for Supabase writes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toDb(obj: unknown): any {
  if (Array.isArray(obj)) return obj.map(toDb)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [camelToSnake(k), toDb(v)])
    )
  }
  return obj
}
