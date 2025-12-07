const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://jllomycpshgbhppipyaj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbG9teWNwc2hnYmhwcGlweWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzg2OTcsImV4cCI6MjA3NTg1NDY5N30.DQYcB25G6blGpQnxyLlaqsX8OTXWMc7q51EtJN35vY4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const createBucket = async () => {
    console.log('Attempting to create storage bucket: transaction-proofs...');

    const { data, error } = await supabase
        .storage
        .createBucket('transaction-proofs', {
            public: true,
            fileSizeLimit: 5242880, // 5MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf']
        });

    if (error) {
        console.error('Error creating bucket:', error);
        console.log('\nFAILED: You likely need to create the bucket manually in the Supabase Dashboard.');
        console.log('Reason:', error.message);
    } else {
        console.log('SUCCESS: Bucket "transaction-proofs" created!');
        console.log(data);
    }
};

createBucket();
