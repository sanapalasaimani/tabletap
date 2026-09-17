import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, 'frontend-web', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('Testing connection to Supabase...');
console.log('URL:', supabaseUrl);
console.log('Anon Key length:', supabaseAnonKey.length);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing credentials in .env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const tables = ['menu_items', 'orders', 'waiter_requests', 'loyalty_profiles', 'feedback', 'inventory', 'staff', 'tables', 'promotions', 'reviews', 'activity_logs', 'pending_staff'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table "${table}" error:`, error.message);
      } else {
        console.log(`✅ Table "${table}" is accessible. Row count check:`, data.length);
      }
    } catch (e) {
      console.log(`❌ Table "${table}" exception:`, e.message);
    }
  }
}

checkTables();
