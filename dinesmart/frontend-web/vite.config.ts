import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createClient } from '@supabase/supabase-js'

function analyticsSqlPlugin(): Plugin {
  return {
    name: 'analytics-sql-proxy',
    configureServer(server) {
      server.middlewares.use('/api/analytics-sql', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { query } = JSON.parse(body || '{}');
            if (!query) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing query in request body' }));
              return;
            }

            const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://rxwllokulbjrkbrcnikf.supabase.co';
            // Securely uses server-side service role key if defined in environment, avoiding exposure to browser bundle
            const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_TosgUWCBgC5bvX171JYGEw_8Q7IP9Ce';

            const supabase = createClient(supabaseUrl, serverKey);
            const { data, error } = await supabase.rpc('execute_readonly_sql', {
              query_text: query
            });

            if (error) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: error.message }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data || []));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        });
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), analyticsSqlPlugin()],
  server: {
    watch: {
      ignored: [
        '**/android/**',
        '**/ml_dataset/**',
        '**/dist/**',
        '**/.git/**',
        '**/.gradle/**',
        '**/.idea/**'
      ]
    }
  }
})
