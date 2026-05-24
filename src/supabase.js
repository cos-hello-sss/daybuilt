import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lmufqtqjwarejpfpdplt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdWZxdHFqd2FyZWpwZnBkcGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTY4NjEsImV4cCI6MjA5NTE5Mjg2MX0.HokdUGko1zdyIQcMfclxQEiD3Y0Ky_eDOsYPrTz-4fQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
