export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const { searchParams } = new URL(request.url);
  const prompt = searchParams.get('prompt');
  
  if (!prompt) {
    return new Response('Prompt is required', { status: 400 });
  }

  const width = searchParams.get('width') || 1920;
  const height = searchParams.get('height') || 1080;
  const seed = searchParams.get('seed') || Math.floor(Math.random() * 1000000);
  
  const targetUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  try {
    const response = await fetch(targetUrl);
    
    // Create new response with CORS headers to be completely safe
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    return newResponse;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to generate image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
