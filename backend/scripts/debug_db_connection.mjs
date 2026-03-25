import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ override: true });

const { Client } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const dbInfo = await client.query('select current_database() as db, current_schema() as schema');
  console.log('Connected to:', dbInfo.rows[0]);

  const schemaCounts = await client.query(
    "select table_schema, count(*)::int as table_count from information_schema.tables where table_type='BASE TABLE' group by table_schema order by table_schema"
  );
  console.log('Table counts by schema:', schemaCounts.rows);

  const publicTables = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"
  );
  console.log('Public tables:', publicTables.rows.map((r) => r.table_name));

  await client.end();
}

main().catch((e) => {
  console.error('Debug failed:', e.message);
  process.exit(1);
});
