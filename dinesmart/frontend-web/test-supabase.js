import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || '';
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || '';

console.log('Testing connection to Supabase...');
console.log('URL:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing credentials in .env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const tables = ['menu_items', 'orders', 'waiter_requests', 'loyalty_profiles', 'feedback', 'inventory', 'staff', 'tables', 'promotions', 'reviews', 'activity_logs'];
  
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
