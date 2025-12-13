import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://myrthifravcxvcqlptcp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cnRoaWZyYXZjeHZjcWxwdGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMjA2MDQsImV4cCI6MjA3OTg5NjYwNH0.IO3AawigN1Vm3U842gTiiIw9oMMBNl3z9XDYuUaPMEI';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runVerification() {
    console.log('Starting Backend Verification...');
    let docId = null;

    try {
        // 1. Test Storage Upload
        console.log('\n[1/4] Testing Storage Upload...');
        const fileName = `test_verification_${Date.now()}.txt`;
        const { data: storageData, error: storageError } = await supabase.storage
            .from('documents')
            .upload(`uploads/${fileName}`, Buffer.from('verification test content')); // Node global Buffer

        if (storageError) throw new Error(`Storage Upload Failed: ${storageError.message}`);
        console.log('✅ Storage Upload Success:', storageData.path);

        // 2. Test Document Insert (DB)
        console.log('\n[2/4] Testing Database Insert (Documents)...');
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                name: 'Verification Test Doc',
                file_path: storageData.path,
                file_size: 1024,
                file_type: 'text/plain',
                share_link: Math.random().toString(36).substring(7),
                allow_download: true,
                is_encrypted: false
            })
            .select()
            .single();

        if (docError) throw new Error(`Document Insert Failed: ${docError.message}`);
        docId = docData.id;
        console.log('✅ Document Insert Success:', docId);

        // 3. Test Signer Insert (DB)
        console.log('\n[3/4] Testing Database Insert (Signers)...');
        const { data: signerData, error: signerError } = await supabase
            .from('document_signers')
            .insert({
                document_id: docId,
                signer_name: 'Test Signer',
                signer_email: 'test@example.com',
                signing_order: 1,
                status: 'pending',
                signing_link: Math.random().toString(36).substring(7)
            })
            .select();

        if (signerError) throw new Error(`Signer Insert Failed: ${signerError.message}`);
        console.log('✅ Signer Insert Success');

        // 4. Cleanup
        console.log('\n[4/4] Cleaning up...');
        // Delete signer
        await supabase.from('document_signers').delete().eq('document_id', docId);
        // Delete document (should cascade delete signers actually, but safety first)
        await supabase.from('documents').delete().eq('id', docId);
        // Delete file
        await supabase.storage.from('documents').remove([storageData.path]);
        console.log('✅ Cleanup Success');

        console.log('\n🎉 ALL BACKEND FEATURES VERIFIED SUCCESSFULLY!');

    } catch (error) {
        console.error('\n❌ VERIFICATION FAILED:', error.message);
        console.error(JSON.stringify(error, null, 2));
        process.exit(1);
    }
}

runVerification();
