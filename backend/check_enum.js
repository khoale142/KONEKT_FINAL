import { query } from './src/config/db.js';
async function main() {
  try {
    const res = await query("SELECT enum_range(NULL::category_scope)");
    console.log(res.rows);
  } catch(e) { console.error(e); }
  process.exit(0);
}
main();
