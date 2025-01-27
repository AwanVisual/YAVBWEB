// Supabase configuration and initialization
const { createClient } = supabase;

const supabaseConfig = {
    url: 'https://crwxvkrsqdkzcmrmjefq.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyd3h2a3JzcWRremNtcm1qZWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4NTgyMTEsImV4cCI6MjA1MzQzNDIxMX0.DeEvmP9-ZZYA1hJwY5BvuT5kFV2x8_1s9bEsnlT0yIs' // Ganti dengan kunci anon yang baru
};

// Initialize Supabase client
const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.key);

// Make it available globally
window.db = supabaseClient; 