// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const reqData = await req.json()
        const { systemPrompt, userMsg, model, fallbackModel } = reqData

        if (!systemPrompt || !userMsg || !model) {
            throw new Error('Missing required fields')
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // We use service role to modify the rate limit table securely
        )

        // Get Client IP
        // x-forwarded-for works on Supabase Edge Functions
        const ipAddress = req.headers.get("x-forwarded-for") || "unknown";
        
        // Rate Limiting Logic for non-paying/unauthenticated requests
        // Check if user is authenticated
        const authHeader = req.headers.get('Authorization')
        let user = null;
        if (authHeader && authHeader.replace('Bearer ', '') !== Deno.env.get('SUPABASE_ANON_KEY')) {
             const token = authHeader.replace('Bearer ', '')
             const { data: userData } = await supabaseClient.auth.getUser(token)
             user = userData?.user
        }

        // If not authenticated, apply strict 2-request limit based on IP
        if (!user && ipAddress !== "unknown") {
            const { data: limitData, error: readError } = await supabaseClient
                .from('template_rate_limits')
                .select('generation_count, last_generation_at')
                .eq('ip_address', ipAddress)
                .single()

            if (readError && readError.code !== 'PGRST116') { // PGRST116 = no rows found
                throw new Error('Rate limit check failed')
            }

            if (limitData && limitData.generation_count >= 2) {
                // Return 429 Too Many Requests
                 return new Response(JSON.stringify({ error: 'Free limit reached. Please login to generate more spreadsheets.' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429,
                })
            }

            // Increment count
            if (limitData) {
                await supabaseClient
                    .from('template_rate_limits')
                    .update({ 
                        generation_count: limitData.generation_count + 1,
                        last_generation_at: new Date().toISOString()
                    })
                    .eq('ip_address', ipAddress)
            } else {
                await supabaseClient
                    .from('template_rate_limits')
                    .insert({ ip_address: ipAddress, generation_count: 1 })
            }
        }

        // Now do the Groq Call
        // Prefer server-side secret GROQ_API_KEY; fall back to VITE_GROQ_API_KEY if set
        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || Deno.env.get('VITE_GROQ_API_KEY');
        if (!GROQ_API_KEY) {
            throw new Error("Missing Groq key. Set GROQ_API_KEY (preferred) or VITE_GROQ_API_KEY in Supabase Function environment.");
        }

        const groqCall = async (targetModel: string) => {
             const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMsg },
                    ],
                    temperature: 0.7,
                    max_tokens: 1500,
                }),
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Groq ${targetModel} error ${res.status}: ${err}`);
            }
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error("Empty response from Groq");
            return content;
        }

        let content;
        try {
            content = await groqCall(model)
        } catch (e) {
            console.error("Primary model failed: ", e)
            if (fallbackModel) {
                 content = await groqCall(fallbackModel)
            } else {
                 throw e
            }
        }

        return new Response(JSON.stringify({ content }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('generate-template error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
