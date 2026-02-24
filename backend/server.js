require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for base64 images

// Gemini API configuration (kept secret on server)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Proxy endpoint for Gemini virtual try-on
app.post('/api/tryon/generate', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { products, productImages } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    // Build the prompt
    const prompt = `Look at these product images I'm providing. Generate a high-quality fashion photograph of a model wearing ALL of these EXACT items together as an outfit.

The items are:
${products.map((p, i) => `${i + 1}. ${p.name} (${p.category}) by ${p.brand}`).join('\n')}

CRITICAL REQUIREMENTS:
- The model MUST wear items that match the EXACT colors, patterns, and styles shown in the reference images
- Image 1 shows the first item, Image 2 shows the second item, etc.
- Combine all items into one cohesive outfit on a single model
- Full-body shot, professional fashion photography style
- Clean white or neutral studio background
- All items must be clearly visible
- Photorealistic, high resolution`;

    // Build parts array with text prompt and all product images
    const parts = [{ text: prompt }];

    if (productImages && productImages.length > 0) {
      for (let i = 0; i < productImages.length; i++) {
        const img = productImages[i];
        if (img.base64) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType || 'image/jpeg',
              data: img.base64
            }
          });
          parts.push({ text: `(Above: ${products[i]?.name || 'Item'} - ${products[i]?.category || 'Fashion'})` });
        }
      }
    }

    const requestBody = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    };

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || 'Failed to generate image'
      });
    }

    const data = await response.json();

    // Extract the generated image from the response
    const candidates = data.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return res.json({
            imageData: part.inlineData.data,
            mimeType: part.inlineData.mimeType || 'image/png'
          });
        }
      }
    }

    return res.status(500).json({ error: 'No image generated in response' });

  } catch (error) {
    console.error('Error in /api/tryon/generate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set in environment variables');
  }
});
