import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lafldhrcafebghijmjbv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhZmxkaHJjYWZlYmdoaWptamJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjY1NzksImV4cCI6MjA5MTQwMjU3OX0.zbCqz9aQeVMX_WkAgrnUSQG8uJyCnAMDVszC1IeDx2I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
