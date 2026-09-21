import { query } from './src/config/db.js';
async function main() {
  try {
    const v = await query("SELECT pg_get_viewdef('v_pos_available_products', true)");
    console.log(v.rows[0].pg_get_viewdef);
  } catch(e) { console.error(e); }
  process.exit(0);
}
main();
