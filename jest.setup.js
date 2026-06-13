// Provide dummy Supabase env so modules that import the client load under test.
// No test hits the network; these are placeholders only.
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "dummy-anon-key";
