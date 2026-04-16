import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jzbpmajvncwslqdrzijr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6YnBtYWp2bmN3c2xxZHJ6aWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzg4MTcsImV4cCI6MjA5MTc1NDgxN30.gZP_ebZs_t5bfcWDBgoHtJRoOuqVYjWqC0kBUMSf8dQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
