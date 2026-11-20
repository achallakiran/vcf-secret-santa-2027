import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Retired old email/password organizer function.
// Use the PIN-authenticated ss-gateway instead.
Deno.serve((_req:Request)=>new Response(
  JSON.stringify({error:"This endpoint has been retired. Please update to the PIN-based organizer console."}),
  {status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
    "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"}}
));
