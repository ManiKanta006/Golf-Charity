import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.\n" +
    "Get these from your Supabase project Settings → API."
  );
  process.exit(1);
}

/**
 * Supabase client using the SERVICE ROLE key.
 *
 * The service role key bypasses Row Level Security (RLS).
 * This is the correct choice for a trusted backend server that
 * manages its own authentication (JWT via Express middleware).
 *
 * If you enable RLS on your tables, this key ensures the backend
 * can still perform all CRUD operations without being blocked.
 * Never expose this key to the client/browser.
 */
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default supabase;
