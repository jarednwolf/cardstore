import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Parse URL to get the API endpoint
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    
    // For Supabase Edge Functions, the path is /functions/v1/api/...
    // So we need to get everything after 'api'
    const apiIndex = pathSegments.indexOf('api')
    const apiPath = apiIndex >= 0 ? pathSegments.slice(apiIndex + 1).join('/') : pathSegments.join('/')
    
    // Get user from JWT if present
    const authHeader = req.headers.get('Authorization')
    let user = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: authUser } } = await supabase.auth.getUser(token)
      user = authUser
    }

    // Route to different endpoints
    switch (apiPath) {
      case 'products':
        return await handleProducts(req, supabase, user)
      
      case 'inventory':
        return await handleInventory(req, supabase, user)
      
      case 'orders':
        return await handleOrders(req, supabase, user)
      
      case 'onboarding/prerequisites':
        return await handleOnboardingPrerequisites(req)
      
      case 'system/status':
        return await handleSystemStatus(req)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})

// Handler functions
async function handleProducts(req: Request, supabase: any, user: any) {
  if (req.method === 'GET') {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return new Response(
      JSON.stringify({ data: products }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
  
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}

async function handleInventory(req: Request, supabase: any, user: any) {
  if (req.method === 'GET') {
    // Return mock inventory data for now
    const inventory = [
      {
        id: '1',
        variantId: 'variant-1',
        sku: 'MTG-ALP-BL-NM',
        onHand: 5,
        reserved: 2,
        available: 3
      }
    ]
    
    return new Response(
      JSON.stringify({ data: inventory }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
  
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}

async function handleOrders(req: Request, supabase: any, user: any) {
  if (req.method === 'GET') {
    // Return mock orders data for now
    const orders = [
      {
        id: '1',
        orderNumber: '1001',
        status: 'processing',
        totalPrice: 100.00,
        createdAt: new Date().toISOString()
      }
    ]
    
    return new Response(
      JSON.stringify({ data: orders }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
  
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}

async function handleOnboardingPrerequisites(req: Request) {
  const prerequisites = {
    nodejs: { required: '18.0.0', installed: '18.0.0', status: 'ok' },
    npm: { required: '9.0.0', installed: '9.0.0', status: 'ok' },
    supabase: { required: 'latest', installed: 'latest', status: 'ok' }
  }
  
  return new Response(
    JSON.stringify({ data: prerequisites }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}

async function handleSystemStatus(req: Request) {
  const status = {
    application: 'running',
    database: 'connected',
    supabase: 'operational',
    timestamp: new Date().toISOString()
  }
  
  return new Response(
    JSON.stringify({ data: status }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}