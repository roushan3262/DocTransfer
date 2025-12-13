import { supabase } from './supabase';
import type { SignatureField } from '../components/SignatureFieldEditor';
import type { Signer } from '../components/SignerManagement';

// Generate a unique signing link
export const generateSigningLink = (): string => {
    const randomId = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
    return `sign-${randomId}`;
};

// Create signers for a document
export const createDocumentSigners = async (
    documentId: string,
    signers: Signer[]
): Promise<{ success: boolean; error?: string; signerIds?: { [key: string]: string } }> => {
    try {
        const signersWithLinks = signers.map((signer) => ({
            document_id: documentId,
            signer_name: signer.name,
            signer_email: signer.email,
            signing_order: signer.order,
            signing_link: signer.signingLink || generateSigningLink(),
            status: 'pending',
            color: signer.color
        }));

        const { data, error } = await supabase
            .from('document_signers')
            .insert(signersWithLinks)
            .select();

        if (error) {
            console.error('Error creating signers:', error);
            return { success: false, error: error.message };
        }

        // Map original signer IDs to database IDs
        const signerIds: { [key: string]: string } = {};
        signers.forEach((signer, index) => {
            if (data && data[index]) {
                signerIds[signer.id] = data[index].id;
            }
        });

        return { success: true, signerIds };
    } catch (error) {
        console.error('Exception creating signers:', error);
        return { success: false, error: String(error) };
    }
};

// Create signature fields for a document
export const createSignatureFields = async (
    documentId: string,
    fields: SignatureField[],
    signerIdMap: { [key: string]: string }
): Promise<{ success: boolean; error?: string }> => {
    try {
        const fieldsToInsert = fields.map((field) => ({
            document_id: documentId,
            field_type: field.type,
            page_number: field.page,
            position_x: field.x,
            position_y: field.y,
            width: field.width,
            height: field.height,
            assigned_signer_id: signerIdMap[field.signerId],
            is_required: field.required
        }));

        const { error } = await supabase
            .from('signature_fields')
            .insert(fieldsToInsert);

        if (error) {
            console.error('Error creating signature fields:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Exception creating signature fields:', error);
        return { success: false, error: String(error) };
    }
};

// Update document to require signature
export const markDocumentRequiresSignature = async (
    documentId: string,
    workflowType: 'sequential' | 'parallel' = 'sequential'
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase
            .from('documents')
            .update({
                requires_signature: true,
                signature_workflow_type: workflowType
            })
            .eq('id', documentId);

        if (error) {
            console.error('Error updating document:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Exception updating document:', error);
        return { success: false, error: String(error) };
    }
};

// Log audit event
export const logAuditEvent = async (
    documentId: string,
    action: string,
    description?: string,
    signerId?: string,
    metadata?: any
): Promise<void> => {
    try {
        await supabase.from('signature_audit_log').insert({
            document_id: documentId,
            signer_id: signerId || null,
            action,
            description,
            metadata
        });
    } catch (error) {
        console.error('Error logging audit event:', error);
    }
};

// Get signing link for document
export const getSigningLinks = async (
    documentId: string
): Promise<{ success: boolean; signers?: any[]; error?: string }> => {
    try {
        const { data, error } = await supabase
            .from('document_signers')
            .select('*')
            .eq('document_id', documentId)
            .order('signing_order');

        if (error) {
            console.error('Error fetching signers:', error);
            return { success: false, error: error.message };
        }

        return { success: true, signers: data || [] };
    } catch (error) {
        console.error('Exception fetching signers:', error);
        return { success: false, error: String(error) };
    }
};

// Complete e-signature setup (all-in-one function)
export const setupDocumentESignature = async (
    documentId: string,
    signers: Signer[],
    fields: SignatureField[],
    workflowType: 'sequential' | 'parallel' = 'sequential'
): Promise<{ success: boolean; error?: string; signingLinks?: any[] }> => {
    try {
        // 1. Create signers
        const { success: signersSuccess, error: signersError, signerIds } = await createDocumentSigners(
            documentId,
            signers
        );

        if (!signersSuccess || !signerIds) {
            return { success: false, error: signersError || 'Failed to create signers' };
        }

        // 2. Create signature fields
        const { success: fieldsSuccess, error: fieldsError } = await createSignatureFields(
            documentId,
            fields,
            signerIds
        );

        if (!fieldsSuccess) {
            return { success: false, error: fieldsError || 'Failed to create signature fields' };
        }

        // 3. Mark document as requiring signature
        const { success: updateSuccess, error: updateError } = await markDocumentRequiresSignature(
            documentId,
            workflowType
        );

        if (!updateSuccess) {
            return { success: false, error: updateError || 'Failed to update document' };
        }

        // 4. Log audit event
        await logAuditEvent(documentId, 'document_created', 'E-signature document created');

        // 5. Get signing links
        const { success: linksSuccess, signers: signingLinks, error: linksError } = await getSigningLinks(
            documentId
        );

        if (!linksSuccess) {
            return { success: false, error: linksError || 'Failed to get signing links' };
        }

        return { success: true, signingLinks };
    } catch (error) {
        console.error('Exception setting up e-signature:', error);
        return { success: false, error: String(error) };
    }
};
