// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    const { plan_id, total_count = 12, customer_notify = 1, customer = {} } = await req.json()
    if (!plan_id) {
      return new Response(JSON.stringify({ error: "plan_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? ""
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? ""
    if (!keyId || !keySecret) {
      return new Response(JSON.stringify({ error: "Missing Razorpay credentials" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const auth = "Basic " + btoa(`${keyId}:${keySecret}`)

    const r = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id,
        total_count,
        customer_notify,
        customer,
      }),
    })

    const body = await r.text()
    if (!r.ok) {
      return new Response(body || JSON.stringify({ error: "Razorpay error" }), {
        status: r.status,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
