import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve((_req:Request)=>new Response(JSON.stringify({
  error:"This organizer endpoint has been retired. Use ss-gateway with the organizer PIN."
}),{
  status:410,
  headers:{
    "Content-Type":"application/json",
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
    "Cache-Control":"no-store"
  }
}));