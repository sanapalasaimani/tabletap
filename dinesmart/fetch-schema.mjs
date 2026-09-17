import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rxwllokulbjrkbrcnikf.supabase.co';
const supabaseAnonKey = 'sb_publishable_TosgUWCBgC5bvX171JYGEw_8Q7IP9Ce';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: staff } = await supabase.from('staff').select('*').limit(1);
  console.log('STAFF:', staff);
  
  const { data: reqs } = await supabase.from('waiter_requests').select('*').limit(1);
  console.log('WAITER_REQUESTS:', reqs);

  const { data: tables } = await supabase.from('tables').select('*').limit(1);
  console.log('TABLES:', tables);
}

run();
