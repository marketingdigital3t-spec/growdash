import https from "https";

const supabaseUrl = "https://cixnvosxqlacjbpymjha.supabase.co";
const token = "EAAWTLjJ8FmEBR0aJ34qwUJYdTjrgOWAUgpVxgZBEHUJvIJ2kREzvkf1G4koAZC2gmpmNvcyRS4OZBqF7js4aZCRSeFvbCvXKpK9nZB513zOdglu45jMyHv02elp0LLZCaeabKh10khn7c1UlZCuBBh2NUNEwoaDa8yMU57HBu0A5mTrGJGGh5i1NoP4GUbA2gZDZD";
const apiKey = "sb_publishable_z8AGO0BnFocDtOVyaYMbNQ_JiEYpPIY"; // Public API key allows authentication updates if matching row owners

// Make request to Supabase REST Endpoint
const options = {
  hostname: 'cixnvosxqlacjbpymjha.supabase.co',
  port: 443,
  path: '/rest/v1/ad_accounts',
  method: 'PATCH',
  headers: {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
};

const data = JSON.stringify({
  access_token: token,
  connection_status: 'connected',
  last_sync_error: null,
  last_sync_error_code: null
});

console.log("Desparando requisição imediata de atualização para Supabase...");

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`RETORNO: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`Erro na requisição: ${e.message}`);
});

req.write(data);
req.end();
