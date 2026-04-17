import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jzbpmajvncwslqdrzijr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6YnBtYWp2bmN3c2xxZHJ6aWpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE3ODgxNywiZXhwIjoyMDkxNzU0ODE3fQ.kNWrI3eQenQvsrvqmac-BJ4r33XV7AArdZcqYXGt0zs';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
export { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
