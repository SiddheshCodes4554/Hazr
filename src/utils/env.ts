/**
 * Strongly-typed environment variables validation and access.
 * Expo automatically bundles variables starting with EXPO_PUBLIC_.
 */

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GROQ_API_KEY: string;
}

const getEnv = (): Env => {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const groqApiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;

  if (!supabaseUrl) {
    console.warn(
      "⚠️ EXPO_PUBLIC_SUPABASE_URL is missing. Please define it in your .env file."
    );
  }

  if (!supabaseAnonKey) {
    console.warn(
      "⚠️ EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Please define it in your .env file."
    );
  }

  if (!groqApiKey) {
    console.warn(
      "⚠️ EXPO_PUBLIC_GROQ_API_KEY is missing. Please define it in your .env file."
    );
  }

  return {
    SUPABASE_URL: supabaseUrl || "https://placeholder-project.supabase.co",
    SUPABASE_ANON_KEY: supabaseAnonKey || "placeholder-key",
    GROQ_API_KEY: groqApiKey || "",
  };
};

export const env = getEnv();
export default env;
