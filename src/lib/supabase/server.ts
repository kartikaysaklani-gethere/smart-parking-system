import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy-smart-parking.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role-key';

  return createSupabaseClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
