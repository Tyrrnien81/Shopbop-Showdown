// Lambda handler for Gemini virtual try-on image generation.
// NOTE: This function is duplicated from backend/server.js (generateSingleImage).
// If you modify generateSingleImage in server.js, update this file too.
//
// Zero npm dependencies — uses Node.js 20.x built-in fetch.
// Lambda specs: Node.js 20.x runtime, 512MB memory, 30s timeout.

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// Entry point invoked by AWS Lambda.
// event shape: { products, productImages, variation?, userPhoto? }
// Returns: { statusCode, imageData, mimeType } on success
//          { statusCode, error }               on failure
exports.handler = async (event) => {
  const { products, productImages, variation = 0, userPhoto } = event;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { statusCode: 500, error: 'GEMINI_API_KEY not configured in Lambda environment' };
  }

  if (!products || !Array.isArray(products) || products.length === 0) {
    return { statusCode: 400, error: 'products array is required' };
  }

  try {
    const image = await generateSingleImage(products, productImages, variation, userPhoto, apiKey);
    return { statusCode: 200, imageData: image.imageData, mimeType: image.mimeType };
  } catch (err) {
    console.error('generateSingleImage failed:', err.message);
    return { statusCode: 500, error: err.message };
  }
};

// Generates a single try-on image via the Gemini API.
// Adapted from generateSingleImage in backend/server.js — apiKey is passed
// as a parameter instead of read from a module-level variable.
async function generateSingleImage(products, productImages, variation = 0, userPhoto = null, apiKey) {
  const variationPrompts = [
    'standing in a confident pose',
    'in a relaxed, natural pose',
    'walking forward with dynamic movement',
  ];

  const hasUserPhoto = userPhoto && userPhoto.base64;
  const parts = [];

  // Put reference photo FIRST so Gemini sees it before any instructions
  if (hasUserPhoto) {
    parts.push({ text: 'REFERENCE PERSON (the generated model MUST look exactly like this person):' });
    parts.push({
      inlineData: {
        mimeType: userPhoto.mimeType || 'image/jpeg',
        data: userPhoto.base64,
      },
    });
  }

  const prompt = hasUserPhoto
    ? `Now look at the product images below and generate a high-quality fashion photograph of THIS EXACT PERSON wearing ALL of these items together as an outfit.

The items are:
${products.map((p, i) => `${i + 1}. ${p.name} (${p.category}) by ${p.brand}`).join('\n')}

CRITICAL REQUIREMENTS:
- You MUST generate the SAME person shown in the reference photo above — identical face, skin tone, hair color, hair style, and body type. Do not substitute a different person.
- The model MUST wear items that match the EXACT colors, patterns, and styles shown in the product images
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

  parts.push({ text: prompt });

  if (productImages && productImages.length > 0) {
    for (let i = 0; i < productImages.length; i++) {
      const img = productImages[i];
      if (img.base64) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.base64,
          },
        });
        parts.push({ text: `(Above: ${products[i]?.name || 'Item'} - ${products[i]?.category || 'Fashion'})` });
      }
    }
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to generate image');
  }

  const data = await response.json();
  if (data.candidates?.[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inlineData) {
        return { imageData: part.inlineData.data, mimeType: part.inlineData.mimeType || 'image/png' };
      }
    }
  }
  throw new Error('No image in response');
}
