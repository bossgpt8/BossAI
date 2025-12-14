module.exports = async function handler(req, res) {
  // CORS Headers (Keep these the same)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. --- DESTUCTURE modelId from the request body ---
    const { prompt, modelId } = req.body; 
    
    // Safety checks for required inputs
    if (!prompt || !modelId) {
        return res.status(400).json({ error: 'Missing prompt or modelId in request body' });
    }
    
    const hfApiKey = process.env.HUGGINGFACE_API_KEY;

    if (!hfApiKey) {
      return res.status(500).json({ error: 'Hugging Face API key not configured' });
    }

    // --- 2. DYNAMIC MODEL CONFIGURATION ---
    let API_URL;
    let parameters = {};
    
    const HF_MODEL_MAP = {
        // Z-Image-Turbo (Your new, fast model)
        "hf-z-image-turbo": "Tongyi-MAI/Z-Image-Turbo",
        
        // Stable Diffusion XL (Your existing high-quality model)
        "hf-sdxl-base": "stabilityai/stable-diffusion-xl-base-1.0",
        
        // You can add more models here easily!
    };
    
    const selectedHFModel = HF_MODEL_MAP[modelId];

    if (!selectedHFModel) {
        return res.status(400).json({ error: `Invalid image model ID: ${modelId}` });
    }
    
    API_URL = `https://api-inference.huggingface.co/models/${selectedHFModel}`;
    
    // --- 3. ADJUST PARAMETERS BASED ON THE MODEL ---
    if (modelId === "hf-z-image-turbo") {
        // Z-Image-Turbo is highly optimized and often works best with low steps and guidance
        parameters = {
            num_inference_steps: 9, // Recommended 8-9 steps for Turbo speed
            guidance_scale: 0.0,    // Recommended 0.0 for Z-Image-Turbo
            negative_prompt: "blurry, low quality, distorted, bad text, watermark"
        };
    } else { // Defaults for SDXL (hf-sdxl-base)
        parameters = {
            num_inference_steps: 30,
            guidance_scale: 7.5,
            negative_prompt: "blurry, low quality, distorted, bad anatomy"
        };
    }

    // --- 4. API CALL (same as before, but with dynamic URL and parameters) ---
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: parameters, // Use the dynamically set parameters
      })
    });

    if (!response.ok) {
      // Improved error logging
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Image generation failed with status: ${response.status}`;
      console.error(`HF API Error for ${modelId}:`, errorMessage);
      throw new Error(errorMessage);
    }

    // --- 5. RESPONSE HANDLING (Keep these the same) ---
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    // NOTE: Hugging Face usually returns JPG, so 'image/jpeg' is safest.
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
};
