import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rxwllokulbjrkbrcnikf.supabase.co';
const supabaseAnonKey = 'sb_publishable_TosgUWCBgC5bvX171JYGEw_8Q7IP9Ce';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('staff').insert({ id: 'foo' }).select();
  console.log('Error:', error);
}

run();
