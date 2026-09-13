export const environment = {
  production: true,
  demoMode: false,
  // Enable only for the intentionally public hackathon review accounts.
  hackathonDemoAccounts: true,
  supabaseUrl: 'https://qqjgsckhecrjsrvnkgal.supabase.co',
  // Supabase anon keys are designed to be public. Database RLS and RPC checks
  // enforce access; never place a service-role or Gemini key in this file.
  supabaseAnonKey: 'sb_publishable_QYHXTXmKSNulr2xYsBBMPw_6CI85gM1',
  mapDefault: { lat: 24.8607, lng: 67.0011 }
};
