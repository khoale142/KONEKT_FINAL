import { query } from './src/config/db.js';
async function main() {
  try {
    const p = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'");
    console.log('Products:', p.rows);
    const r = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'recipes'");
    console.log('Recipes:', r.rows);
    const ri = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'recipe_items'");
    console.log('Recipe Items:', ri.rows);
  } catch(e) { console.error(e); }
  process.exit(0);
}
main();
