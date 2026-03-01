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

// Helper function to generate a single image
async function generateSingleImage(products, productImages, variation = 0, userPhoto = null) {
  const variationPrompts = [
    'standing in a confident pose',
    'in a relaxed, natural pose',
    'walking forward with dynamic movement'
  ];

  const hasUserPhoto = userPhoto && userPhoto.base64;

  const prompt = hasUserPhoto
    ? `Look at the reference photo of this person and the product images I'm providing. Generate a high-quality fashion photograph of a model who looks EXACTLY like the person in the reference photo, wearing ALL of these EXACT items together as an outfit.

The items are:
${products.map((p, i) => `${i + 1}. ${p.name} (${p.category}) by ${p.brand}`).join('\n')}

CRITICAL REQUIREMENTS:
- The model MUST closely resemble the person in the reference photo — match their face, skin tone, hair color, hair style, and body type
- The model MUST wear items that match the EXACT colors, patterns, and styles shown in the product reference images
- Combine all items into one cohesive outfit on the model
- The model should be ${variationPrompts[variation % variationPrompts.length]}
- Full-body shot, professional fashion photography style
- Clean white or neutral studio background
- All items must be clearly visible
- Photorealistic, high resolution`
    : `Look at these product images I'm providing. Generate a high-quality fashion photograph of a model wearing ALL of these EXACT items together as an outfit.

The items are:
${products.map((p, i) => `${i + 1}. ${p.name} (${p.category}) by ${p.brand}`).join('\n')}

CRITICAL REQUIREMENTS:
- The model MUST wear items that match the EXACT colors, patterns, and styles shown in the reference images
- Combine all items into one cohesive outfit on a single model
- The model should be ${variationPrompts[variation % variationPrompts.length]}
- Full-body shot, professional fashion photography style
- Clean white or neutral studio background
- All items must be clearly visible
- Photorealistic, high resolution`;

  const parts = [{ text: prompt }];

  // Add user photo first if provided
  if (hasUserPhoto) {
    parts.push({
      inlineData: {
        mimeType: userPhoto.mimeType || 'image/jpeg',
        data: userPhoto.base64
      }
    });
    parts.push({ text: '(Above: Reference photo of the person — the generated model should look like this person)' });
  }

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
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to generate image');
  }

  const data = await response.json();
  const candidates = data.candidates;

  if (candidates && candidates[0]?.content?.parts) {
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        return {
          imageData: part.inlineData.data,
          mimeType: part.inlineData.mimeType || 'image/png'
        };
      }
    }
  }

  throw new Error('No image in response');
}

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Proxy endpoint for Gemini virtual try-on (generates 3 images)
app.post('/api/tryon/generate', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { products, productImages, count = 3, userPhoto } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    const imageCount = Math.min(count, 3); // Max 3 images

    // Parse user photo from data URL if provided
    let parsedUserPhoto = null;
    if (userPhoto) {
      const match = userPhoto.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parsedUserPhoto = { mimeType: match[1], base64: match[2] };
      }
    }

    // Generate images sequentially with delay to avoid rate limiting
    const images = [];
    const errors = [];

    for (let i = 0; i < imageCount; i++) {
      try {
        console.log(`Generating image ${i + 1} of ${imageCount}...`);
        const result = await generateSingleImage(products, productImages, i, parsedUserPhoto);
        images.push(result);
        console.log(`Image ${i + 1} generated successfully`);

        // Add delay between requests to avoid rate limiting (except after last one)
        if (i < imageCount - 1) {
          console.log('Waiting 2 seconds before next request...');
          await delay(2000);
        }
      } catch (err) {
        console.error(`Error generating image ${i + 1}:`, err.message);
        errors.push(err.message);
        // Continue trying to generate other images
      }
    }

    if (images.length === 0) {
      return res.status(500).json({
        error: errors[0] || 'Failed to generate any images'
      });
    }

    console.log(`Successfully generated ${images.length} of ${imageCount} images`);
    return res.json({ images });

  } catch (error) {
    console.error('Error in /api/tryon/generate:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint for generating a single image (for individual regeneration)
app.post('/api/tryon/generate-single', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { products, productImages, variation = 0, userPhoto } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ error: 'No products provided' });
    }

    // Parse user photo from data URL if provided
    let parsedUserPhoto = null;
    if (userPhoto) {
      const match = userPhoto.match(/^data:(.+);base64,(.+)$/);
      if (match) {
        parsedUserPhoto = { mimeType: match[1], base64: match[2] };
      }
    }

    console.log(`Generating single image with variation ${variation}...`);
    const result = await generateSingleImage(products, productImages, variation, parsedUserPhoto);
    console.log('Single image generated successfully');

    return res.json(result);

  } catch (error) {
    console.error('Error in /api/tryon/generate-single:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.warn('WARNING: GEMINI_API_KEY is not set in environment variables');
  }
});
