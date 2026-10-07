import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../src/lib/db";

async function main() {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL이 필요합니다.");
  await sql.unsafe(readFileSync(join(process.cwd(), "db/schema.sql"), "utf8"));
  console.log("스키마 적용 완료");
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
