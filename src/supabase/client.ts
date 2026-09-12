import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY sind nicht gesetzt. Kopiere .env.example zu .env und trage dein Supabase-Projekt ein.",
  );
}

// Falls back to a syntactically valid but non-functional URL so the app can
// still render (Home page, UI review) before a real Supabase project is
// wired up via .env — only actual network calls will fail until then.
export const supabase = createClient(url ?? "https://placeholder.supabase.co", anonKey ?? "public-anon-key-placeholder");
