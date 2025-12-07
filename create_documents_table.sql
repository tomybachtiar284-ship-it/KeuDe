-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL, -- 'penawaran', 'invoice', 'kwitansi'
    number TEXT,
    date DATE,
    company_info JSONB,
    customer_info JSONB,
    items JSONB,
    notes TEXT,
    recipient_name TEXT,
    kwitansi_data JSONB,
    status TEXT DEFAULT 'saved'
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all access for anon (for prototype)
CREATE POLICY "Enable all for anon documents" ON documents FOR ALL USING (true) WITH CHECK (true);
