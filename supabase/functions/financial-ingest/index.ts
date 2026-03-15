// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Papa from "https://esm.sh/papaparse@5.4.1"
import * as XLSX from "https://esm.sh/xlsx@0.18.5"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) throw new Error("Missing authorization header")
    const token = authHeader.replace("Bearer ", "")

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    )

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) throw new Error("Unauthorized")

    // Retrieve Step 6 Payload
    const { storagePath, fileName, fileSize, mapping, timestamp, workbenchId } = await req.json()

    if (!storagePath) throw new Error("Missing storage path")

    // 1. Download file from Storage Bucket
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from("raw_imports")
      .download(storagePath)

    if (downloadError || !fileData) throw new Error("Failed to download file from bucket")

    const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
    let parsedRows = [];

    // 2. Parse CSV or XLSX (Step 6 worker parsing)
    if (fileExt === 'xlsx' || fileExt === 'xls') {
      const arrayBuffer = await fileData.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      parsedRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
    } else {
      const fileText = await fileData.text();
      const parseResult = Papa.parse(fileText, {
        header: true,
        skipEmptyLines: true
      });
      parsedRows = parseResult.data;
    }

    // 3. Financial Normalization (Step 7) & Validation Score Metrics (Step 8)
    let validRowsCount = 0
    let invalidRowsCount = 0
    const normalizedRecords = []
    
    // Insights trackers (Step 10)
    let totalVolume = 0
    const categoryTallies = {}

    parsedRows.forEach((row) => {
      let isRowValid = true
      
      const rawDate = row[mapping.transaction_date]
      let rawAmount = null
      
      // Determine amount from unified or split columns
      if (mapping.amount) {
        rawAmount = row[mapping.amount]
      } else {
        const debitStr = String(row[mapping.debit] || "").replace(/[$€£¥₹%,\s]/g, "")
        const creditStr = String(row[mapping.credit] || "").replace(/[$€£¥₹%,\s]/g, "")
        
        const dVal = debitStr ? Number(debitStr) : 0;
        const cVal = creditStr ? Number(creditStr) : 0;
        
        // Negative for debits (outflows), positive for credits (inflows)
        // Adjust this logic if needed based on typical bank statement flow
        if (dVal > 0) rawAmount = -Math.abs(dVal);
        else if (cVal > 0) rawAmount = Math.abs(cVal);
        else rawAmount = 0;
      }

      const rawCategory = row[mapping.category] || "Uncategorized"
      const rawCounterparty = row[mapping.counterparty] || "Unknown"
      const rawAccount = row[mapping.account] || "Default"

      // Clean amount if unified
      let amountNum = 0;
      if (mapping.amount) {
        const cleanAmt = String(rawAmount || "").replace(/[$€£¥₹%,\s]/g, "")
        amountNum = Number(cleanAmt)
      } else {
        amountNum = Number(rawAmount) // Already numeric from split logic
      }
      
      if (!rawDate || isNaN(Date.parse(rawDate))) isRowValid = false
      if (isNaN(amountNum) || (mapping.amount && rawAmount === undefined)) isRowValid = false
      
      if (isRowValid) {
        validRowsCount++
        totalVolume += Math.abs(amountNum)
        categoryTallies[rawCategory] = (categoryTallies[rawCategory] || 0) + Math.abs(amountNum)

        normalizedRecords.push({
          user_id: user.id,
          transaction_date: new Date(rawDate).toISOString(),
          amount: amountNum,
          category: rawCategory,
          counterparty: rawCounterparty,
          account: rawAccount,
          metadata: row // Store raw row context just in case
        })
      } else {
        invalidRowsCount++
      }
    })

    // Quality Score calculation (Step 8)
    const qualityScore = parsedRows.length > 0 
      ? Math.round((validRowsCount / parsedRows.length) * 100) 
      : 0
    
    // Insights Generation (Step 10)
    const sortedCategories = Object.entries(categoryTallies).sort((a,b) => b[1] - a[1])
    const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : "None"

    const insights = {
      topCategory,
      totalVolume,
      qualityScore,
      validRows: validRowsCount,
      invalidRows: invalidRowsCount,
      totalRowsProcessed: parsedRows.length
    }

    // 4. Save to Database (Step 7 canonical entities)
    // First create a parent dataset reference
    const { data: dataset, error: datasetError } = await supabaseAdmin
      .from("user_datasets")
      .insert({
        user_id: user.id,
        workbench_id: workbenchId || null,
        filename: fileName,
        row_count: parsedRows.length,
        status: "completed",
        quality_score: qualityScore,
        metadata: insights
      })
      .select()
      .single()

    if (datasetError) throw datasetError

    // Map dataset_id to records and insert in batches
    if (normalizedRecords.length > 0) {
      const recordsToInsert = normalizedRecords.map(r => ({ ...r, dataset_id: dataset.id }))
      
      // Batch insert logic (Supabase PostgREST handles ~10k chunks fine, but breaking to chunks of 2000)
      const chunkSize = 2000
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        const chunk = recordsToInsert.slice(i, i + chunkSize)
        const { error: insertError } = await supabaseAdmin
          .from("financial_records") // Requires this table to exist
          .insert(chunk)
          
        if (insertError) {
          console.warn("Batch insert warning:", insertError)
          throw insertError; // throw to surface to the UI
        }
      }

      // If ingested directly from a Workbench, also populate workbench_records for legacy dashboard charts
      if (workbenchId) {
        const wbRecordsToInsert = normalizedRecords.map(r => ({
          workbench_id: workbenchId,
          record_type: "transaction",
          net_amount: Math.abs(r.amount),
          gross_amount: Math.abs(r.amount),
          issue_date: r.transaction_date.split('T')[0],
          summary: r.counterparty || "Imported Record",
          status: "confirmed",
          metadata: {
            direction: r.amount >= 0 ? "credit" : "debit",
            category: r.category,
            transaction_date: r.transaction_date.split('T')[0],
            payment_type: "bank"
          }
        }))

        for (let i = 0; i < wbRecordsToInsert.length; i += chunkSize) {
          const chunk = wbRecordsToInsert.slice(i, i + chunkSize)
          const { error: wbInsertError } = await supabaseAdmin
            .from("workbench_records")
            .insert(chunk)
            
          if (wbInsertError) {
            console.warn("WB Batch insert warning:", wbInsertError)
            throw wbInsertError; // throw to surface to the UI
          }
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      dataset: dataset,
      insights: insights 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error("financial-ingest error:", error.message)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
