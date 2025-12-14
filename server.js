const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { messages, model } = JSON.parse(body);
                const apiKey = process.env.OPENROUTER_API_KEY;
                
                if (!apiKey) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'OpenRouter API key not configured. Please add your API key in Secrets.' }));
                    return;
                }

                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://bossgpt-ai.vercel.app',
                        'X-Title': 'BossAI'
                    },
                    body: JSON.stringify({
                        model: model || 'amazon/nova-2-lite-v1:free',
                        messages: messages
                    })
                });

                const data = await response.json();
                
                if (data.error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: data.error.message || 'API Error' }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    content: data.choices?.[0]?.message?.content || 'No response generated'
                }));
            } catch (error) {
                console.error('Chat API error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to process request' }));
            }
        });
        return;
    }
    
    if (req.method === 'POST' && req.url === '/api/generate-image') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                // 1. --- DESTUCTURE modelId from the request body ---
                const { prompt, modelId } = JSON.parse(body);
                
                if (!prompt || !modelId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing prompt or modelId in request body' }));
                    return;
                }
                
                const hfApiKey = process.env.HUGGINGFACE_API_KEY;
                
                if (!hfApiKey) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Hugging Face API key not configured. Please add HUGGINGFACE_API_KEY in Secrets.' }));
                    return;
                }

                // --- 2. DYNAMIC MODEL CONFIGURATION ---
                const HF_MODEL_MAP = {
                    "hf-z-image-turbo": "Tongyi-MAI/Z-Image-Turbo", // Your fast model
                    "hf-sdxl-base": "stabilityai/stable-diffusion-xl-base-1.0", // Your quality model
                };
                
                const selectedHFModel = HF_MODEL_MAP[modelId];

                if (!selectedHFModel) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: `Invalid image model ID: ${modelId}` }));
                    return;
                }
                
                const API_URL = `https://api-inference.huggingface.co/models/${selectedHFModel}`;
                let parameters = {};

                // --- 3. ADJUST PARAMETERS BASED ON THE MODEL ---
                if (modelId === "hf-z-image-turbo") {
                    // Optimized parameters for Z-Image-Turbo (fast)
                    parameters = {
                        num_inference_steps: 9, 
                        guidance_scale: 0.0,    
                        negative_prompt: "blurry, low quality, distorted, bad text, watermark"
                    };
                } else { 
                    // Parameters for SDXL (high quality, default)
                    parameters = {
                        num_inference_steps: 30,
                        guidance_scale: 7.5,
                        negative_prompt: "blurry, low quality, distorted, bad anatomy"
                    };
                }

                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${hfApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        inputs: prompt,
                        parameters: parameters // Use the dynamic parameters
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error || `Image generation failed with status: ${response.status}`;
                    console.error(`HF API Error for ${modelId}:`, errorMessage);
                    throw new Error(errorMessage);
                }

                const imageBuffer = await response.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                const imageUrl = `data:image/jpeg;base64,${base64Image}`;

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ imageUrl }));
            } catch (error) {
                console.error('Image generation error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message || 'Failed to generate image' }));
            }
        });
        return;
    }
    
    if (req.method === 'GET' && req.url === '/api/status') {
        const hasApiKey = !!process.env.OPENROUTER_API_KEY;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ configured: hasApiKey }));
        return;
    }

    if (req.method === 'GET' && req.url === '/api/firebase-config') {
        const firebaseConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        };
        
        const configured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            configured, 
            config: configured ? firebaseConfig : null 
        }));
        return;
    }
    
    // Parse URL to remove query strings
    const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`BossAI server running at http://0.0.0.0:${PORT}`);
});
