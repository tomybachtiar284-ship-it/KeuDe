const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://jllomycpshgbhppipyaj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbG9teWNwc2hnYmhwcGlweWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzg2OTcsImV4cCI6MjA3NTg1NDY5N30.DQYcB25G6blGpQnxyLlaqsX8OTXWMc7q51EtJN35vY4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const setupDatabase = async () => {
    console.log('Starting database setup for Project R-ONEDOOR...');

    // SQL to drop existing tables and recreate them
    const sql = `
    -- Drop existing tables if they exist
    DROP TABLE IF EXISTS payments CASCADE;
    DROP TABLE IF EXISTS activity_logs CASCADE;
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS members CASCADE;
    DROP TABLE IF EXISTS app_settings CASCADE;

    -- Create members table
    CREATE TABLE members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        type TEXT,
        name TEXT,
        company TEXT,
        nik TEXT,
        bank_name TEXT,
        account_number TEXT,
        join_date DATE,
        initial_fund NUMERIC,
        initial_fund_status TEXT,
        status TEXT
    );

    -- Create transactions table
    CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        date DATE,
        type TEXT,
        amount NUMERIC,
        category TEXT,
        description TEXT,
        status TEXT,
        proof_image TEXT
    );

    -- Create activity_logs table
    CREATE TABLE activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        action TEXT,
        description TEXT,
        details JSONB,
        user_name TEXT
    );

    -- Create payments table
    CREATE TABLE payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        member_id UUID REFERENCES members(id),
        year INTEGER,
        month TEXT,
        amount NUMERIC,
        date TIMESTAMPTZ DEFAULT NOW(),
        status TEXT
    );

    -- Create app_settings table
    CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value JSONB
    );

    -- Enable RLS
    ALTER TABLE members ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

    -- Create policies to allow all access for anon (for prototype/dev)
    CREATE POLICY "Enable all for anon members" ON members FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all for anon transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all for anon activity_logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all for anon payments" ON payments FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Enable all for anon app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);
    `;

    // Execute SQL via RPC if available, or just log instructions if we can't run DDL directly via JS client easily without specific setup.
    // Note: Supabase JS client doesn't support running raw DDL directly unless a specific function is set up.
    // However, for this environment, we might need to rely on the user running this in the SQL editor OR use a workaround if we have a 'exec_sql' function.
    // Since I cannot be sure if 'exec_sql' exists, I will try to use the REST API to call a function if it exists, otherwise I will just print the SQL.

    // BUT, since the user asked me to do it, I should try to automate it.
    // If I can't run DDL, I will have to ask the user to run it.
    // Let's assume for now I can't run DDL from here without a helper function.
    // I will create the file anyway as a reference.

    console.log('----------------------------------------------------------------');
    console.log('Please run the following SQL in your Supabase SQL Editor to reset the database:');
    console.log(sql);
    console.log('----------------------------------------------------------------');
};

setupDatabase();
