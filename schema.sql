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
