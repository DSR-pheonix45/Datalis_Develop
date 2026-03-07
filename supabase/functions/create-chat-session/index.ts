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
        // Get user from auth header FIRST
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing authorization header')

        const token = authHeader.replace('Bearer ', '')

        // Create a client that impersonates the user via their JWT
        // This ensures auth.uid() returns the correct user in triggers
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: `Bearer ${token}` }
                }
            }
        )

        // Verify the user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
        if (userError || !user) throw new Error('Unauthorized: ' + (userError?.message || 'No user found'))

        const { title, workbench_id } = await req.json()

        if (!title) throw new Error('Title is required')

        const { data: session, error } = await supabaseClient
            .from("chat_sessions")
            .insert({
                user_id: user.id,
                workbench_id: workbench_id || null,
                title: title.substring(0, 200), // Truncate title to prevent overly long values
            })
            .select()
            .single();

        if (error) {
            console.error('Insert error:', JSON.stringify(error))
            // If it's a plan limit error, return a specific message
            if (error.message?.includes('limit reached')) {
                return new Response(JSON.stringify({
                    error: error.message,
                    code: 'PLAN_LIMIT_REACHED'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403,
                })
            }
            throw error;
        }

        return new Response(JSON.stringify(session), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('create-chat-session error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
