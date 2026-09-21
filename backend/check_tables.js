import { query } from './src/config/db.js';
async function main() {
  try {
    const t = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(t.rows);
  } catch(e) { console.error(e); }
  process.exit(0);
}
main();
