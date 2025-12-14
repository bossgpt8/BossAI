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
        "hf-z-image-turbo": "Tongyi-MAI/Z-Image-Turbo",
        "hf-sdxl-base": "stabilityai/stable-diffusion-xl-base-1.0",
    };
    
    const selectedHFModel = HF_MODEL_MAP[modelId];

    if (!selectedHFModel) {
        return res.status(400).json({ error: `Invalid image model ID: ${modelId}` });
    }
    
    API_URL = `https://api-inference.huggingface.co/models/${selectedHFModel}`;
    
    // --- 3. ADJUST PARAMETERS BASED ON THE MODEL ---
    if (modelId === "hf-z-image-turbo") {
        // Optimized parameters for Z-Image-Turbo (fast)
        parameters = {
            num_inference_steps: 9, 
            guidance_scale: 0.0,    
            negative_prompt: "blurry, low quality, distorted, bad text, watermark",
            width: 1024,   // <-- ADDED: Default to high resolution
            height: 1024,  // <-- ADDED: Default to high resolution
        };
    } else { // Defaults for SDXL (hf-sdxl-base)
        // Optimized parameters for SDXL (high quality)
        parameters = {
            num_inference_steps: 30,
            guidance_scale: 7.5,
            negative_prompt: "blurry, low quality, distorted, bad anatomy",
            width: 1024,   // <-- ADDED: Native SDXL resolution
            height: 1024,  // <-- ADDED: Native SDXL resolution
        };
    }

    // --- 4. API CALL ---
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: parameters, // Uses the dynamically set parameters
      })
    });

    if (!response.ok) {
      // Improved error logging
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Image generation failed with status: ${response.status}`;
      console.error(`HF API Error for ${modelId}:`, errorMessage);
      // Check for specific Hugging Face model loading error (503)
      if (response.status === 503) {
          throw new Error(`Model ${selectedHFModel} is currently loading and will be available shortly. Please try again in 30 seconds.`);
      }
      throw new Error(errorMessage);
    }

    // --- 5. RESPONSE HANDLING ---
    const imageBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    return res.status(200).json({ imageUrl });

  } catch (error) {
    console.error('Image generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate image' });
  }
};
