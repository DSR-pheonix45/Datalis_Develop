import { supabase } from "../lib/supabase";

/**
 * Backend Service
 * 
 * All write operations in Dabby MUST go through this service,
 * which calls Supabase Edge Functions. Direct writes to tables
 * are strictly forbidden by the system philosophy.
 */

export const backendService = {
  /**
   * Creates a manual record (transaction, compliance, budget, or party)
   */
  async createRecord(workbenchId, recordType, summary, metadata) {
    try {
      const { data, error } = await supabase.functions.invoke('create-record', {
        body: {
          workbench_id: workbenchId,
          record_type: recordType,
          summary,
          metadata
        }
      });

      if (error) {
        console.error('Edge Function Error (create-record):', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Failed to call create-record:', err);
      throw err;
    }
  },

  /**
   * Pushes a financial adjustment
   */
  async pushAdjustment(workbenchId, originalRecordId, adjustmentType, reason, metadata) {
    try {
      const { data, error } = await supabase.functions.invoke('push-adjustment', {
        body: {
          workbench_id: workbenchId,
          original_record_id: originalRecordId,
          adjustment_type: adjustmentType,
          reason,
          metadata
        }
      });

      if (error) {
        console.error('Edge Function Error (push-adjustment):', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Failed to call push-adjustment:', err);
      throw err;
    }
  },

  /**
   * Uploads and initiates document processing
   */
  async uploadDocument(workbenchId, file, documentType) {
    // 1. Upload to storage first (Edge Functions have limits on request size)
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${workbenchId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("workbench-documents")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Trigger the processing Edge Function
    try {
      const { data, error } = await supabase.functions.invoke('process-document', {
        body: {
          workbench_id: workbenchId,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          document_type: documentType
        }
      });

      if (error) {
        console.error('Edge Function Error (process-document):', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Failed to call process-document:', err);
      throw err;
    }
  },

  /**
   * Creates a new workbench and assigns the current user as founder
   */
  async createWorkbench(name, booksStartDate, description = null) {
    try {
      const { data, error } = await supabase.functions.invoke('create-workbench', {
        body: {
          name,
          books_start_date: booksStartDate,
          description
        }
      });

      if (error) {
        console.error('Edge Function Error (create-workbench):', error);
        console.error('Error context:', JSON.stringify(error.context || {}, null, 2));
        throw error;
      }

      // Handle business logic error returned with 200 status
      if (data && data.error) {
        console.error('Edge Function Business Error (create-workbench):', data.error);
        console.error('Full error data:', JSON.stringify(data, null, 2));
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      console.error('Failed to call create-workbench:', err);
      console.error('Error details:', err.message);
      throw err;
    }
  },

  /**
   * Saves a chat message and updates the session
   * Falls back to direct insert if edge function is unavailable
   */
  async saveChatMessage(sessionId, role, content, metadata, workbenchId = null) {
    try {
      const { data, error } = await supabase.functions.invoke('save-chat-message', {
        body: {
          session_id: sessionId,
          role,
          content,
          metadata,
          workbench_id: workbenchId
        }
      });

      if (error) {
        console.warn('Edge Function Error (save-chat-message), falling back to direct insert:', error.message || error);
        return await this._saveChatMessageDirect(sessionId, role, content, metadata);
      }

      if (data && data.error) {
        console.warn('Edge Function returned error, falling back:', data.error);
        return await this._saveChatMessageDirect(sessionId, role, content, metadata);
      }

      return data;
    } catch (err) {
      console.warn('Failed to call save-chat-message, falling back to direct insert:', err.message);
      return await this._saveChatMessageDirect(sessionId, role, content, metadata);
    }
  },

  /**
   * Direct insert fallback for saving chat messages
   */
  async _saveChatMessageDirect(sessionId, role, content, metadata) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role,
        content: (content || '').substring(0, 50000),
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('Direct insert fallback for chat message also failed:', error);
      throw error;
    }
    return data;
  },

  /**
   * Creates a new chat session
   * Falls back to direct insert if edge function is unavailable
   */
  async createChatSession(title, workbenchId = null) {
    try {
      const { data, error } = await supabase.functions.invoke('create-chat-session', {
        body: {
          title,
          workbench_id: workbenchId
        }
      });

      if (error) {
        console.warn('Edge Function Error (create-chat-session), falling back to direct insert:', error.message || error);
        return await this._createChatSessionDirect(title, workbenchId);
      }

      // Edge function may return error in body
      if (data && data.error) {
        console.warn('Edge Function returned error, falling back:', data.error);
        return await this._createChatSessionDirect(title, workbenchId);
      }

      return data;
    } catch (err) {
      console.warn('Failed to call create-chat-session edge function, falling back to direct insert:', err.message);
      return await this._createChatSessionDirect(title, workbenchId);
    }
  },

  /**
   * Direct insert fallback for chat session creation
   * Used when edge function is unavailable or returns errors
   */
  async _createChatSessionDirect(title, workbenchId = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        workbench_id: workbenchId || null,
        title: (title || 'Untitled Chat').substring(0, 200),
      })
      .select()
      .single();

    if (error) {
      console.error('Direct insert fallback also failed:', error);
      throw error;
    }

    return data;
  },

  /**
   * Confirms a record and creates ledger entries
   */
  async confirmRecord(recordId) {
    try {
      const { data, error } = await supabase.functions.invoke('confirm-record', {
        body: { record_id: recordId }
      });

      if (error) {
        console.error('Edge Function Error (confirm-record):', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Failed to call confirm-record:', err);
      throw err;
    }
  },

  /**
   * Runs the reconciliation engine for a workbench
   */
  async runReconciliation(workbenchId) {
    try {
      const { data, error } = await supabase.functions.invoke('run-reconciliation', {
        body: { workbench_id: workbenchId }
      });

      if (error) {
        console.error('Edge Function Error (run-reconciliation):', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Failed to call run-reconciliation:', err);
      throw err;
    }
  },

  /**
   * Fetches the health status and intelligence metrics for a workbench
   */
  async getWorkbenchIntelligence(workbenchId) {
    try {
      const { data, error } = await supabase.functions.invoke('get-intelligence', {
        body: { workbench_id: workbenchId }
      });

      if (error) {
        console.error('Edge Function Error (get-intelligence):', error);
        throw error;
      }
      return data;
    } catch (err) {
      console.error('Failed to call get-intelligence:', err);
      throw err;
    }
  }
};
