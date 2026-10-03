import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin Client using the SERVICE ROLE key.
 * Used exclusively for server-side administrative tasks such as:
 * - Direct user creation without email confirmation
 * - Direct password updates/resets
 * - User deletion/deactivation in Auth
 *
 * NEVER import or use this on the client side.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
