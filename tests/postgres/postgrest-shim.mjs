// A small PostgREST-compatible HTTP front for a local Postgres, so the server
// tests can run against the real schema, real unique constraints and real
// row-level update atomicity instead of the in-memory store.
//
// It is not PostgREST. It implements exactly the subset `src/lib/server/store.ts`
// uses (eq / is.null / not.is.null / gte / lte / gt / lt / in filters, order,
// limit, insert with representation, upsert via on_conflict + merge-duplicates,
// patch and delete with filters, 409 on unique violations). Run the same tests
// against a real Supabase project before trusting anything this cannot show.
//
//   DATABASE_URL=postgres://user:pass@127.0.0.1:5432/db node tests/postgres/postgrest-shim.mjs 3210
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(process.env.PG_SHIM_REQUIRE_FROM ?? import.meta.url);
const pg = require("pg");

// PostgREST hands timestamps back as ISO strings; so do we.
for (const oid of [1114, 1184, 1082]) pg.types.setTypeParser(oid, (value) => value);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
const port = Number(process.argv[2] ?? 3210);
const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(name) {
  if (!IDENT.test(name)) throw new Error(`bad identifier ${name}`);
  return `"${name}"`;
}

function where(params, values) {
  const clauses = [];
  for (const [key, raw] of params) {
    if (["order", "limit", "on_conflict", "select", "offset"].includes(key)) continue;
    const column = ident(key);
    if (raw === "is.null") clauses.push(`${column} is null`);
    else if (raw === "not.is.null") clauses.push(`${column} is not null`);
    else if (raw.startsWith("in.(")) {
      const items = raw.slice(4, -1).split(",").map((item) => decodeURIComponent(item));
      values.push(items);
      clauses.push(`${column} = any($${values.length})`);
    } else {
      const [op, ...rest] = raw.split(".");
      const value = rest.join(".");
      const sql = { eq: "=", neq: "<>", gte: ">=", lte: "<=", gt: ">", lt: "<" }[op];
      if (!sql) throw new Error(`unsupported operator ${op}`);
      values.push(value);
      clauses.push(`${column} ${sql} $${values.length}`);
    }
  }
  return clauses.length ? ` where ${clauses.join(" and ")}` : "";
}

function orderAndLimit(params) {
  let sql = "";
  const order = params.get("order");
  if (order) {
    const [column, direction] = order.split(".");
    sql += ` order by ${ident(column)} ${direction === "desc" ? "desc" : "asc"}`;
  }
  const limit = params.get("limit");
  if (limit) sql += ` limit ${Number(limit)}`;
  return sql;
}

function json(value) {
  return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
}

async function handle(req, body) {
  const url = new URL(req.url, "http://shim");
  const match = url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  if (!match) return [404, { message: "not found" }];
  const table = ident(match[1]);
  const params = url.searchParams;
  const values = [];
  const prefer = req.headers.prefer ?? "";

  if (req.method === "GET") {
    const { rows } = await pool.query(`select * from ${table}${where(params, values)}${orderAndLimit(params)}`, values);
    return [200, rows];
  }

  if (req.method === "POST") {
    const rows = Array.isArray(body) ? body : [body];
    if (!rows.length) return [201, []];
    const columns = Object.keys(rows[0]);
    const placeholders = rows
      .map((row, r) => `(${columns.map((_, c) => `$${r * columns.length + c + 1}`).join(", ")})`)
      .join(", ");
    for (const row of rows) for (const column of columns) values.push(json(row[column] ?? null));
    let sql = `insert into ${table} (${columns.map(ident).join(", ")}) values ${placeholders}`;
    const conflict = params.get("on_conflict");
    if (conflict && prefer.includes("merge-duplicates")) {
      const updates = columns.filter((column) => column !== conflict).map((column) => `${ident(column)} = excluded.${ident(column)}`);
      sql += ` on conflict (${ident(conflict)}) do update set ${updates.join(", ")}`;
    }
    sql += " returning *";
    const result = await pool.query(sql, values);
    return [201, result.rows];
  }

  if (req.method === "PATCH") {
    const columns = Object.keys(body);
    const sets = columns.map((column) => {
      values.push(json(body[column]));
      return `${ident(column)} = $${values.length}`;
    });
    const clause = where(params, values);
    if (!clause) return [400, { message: "refusing to update without a filter" }];
    const { rows } = await pool.query(`update ${table} set ${sets.join(", ")}${clause} returning *`, values);
    return [200, rows];
  }

  if (req.method === "DELETE") {
    const clause = where(params, values);
    if (!clause) return [400, { message: "refusing to delete without a filter" }];
    const { rows } = await pool.query(`delete from ${table}${clause} returning *`, values);
    return [200, rows];
  }
  return [405, { message: "method not allowed" }];
}

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", async () => {
    let status = 500;
    let payload = { message: "internal" };
    try {
      const body = raw ? JSON.parse(raw) : null;
      [status, payload] = await handle(req, body);
    } catch (error) {
      if (error.code === "23505") {
        status = 409;
        payload = { code: "23505", message: error.detail ?? "duplicate key" };
      } else {
        status = 400;
        payload = { code: error.code ?? "shim", message: error.message };
      }
    }
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`postgrest shim listening on http://127.0.0.1:${port}`);
});
