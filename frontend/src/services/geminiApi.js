// Gemini API service for virtual try-on using Nano Banana (Gemini 2.5 Flash Image)

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAC17HuVSLtXyAJGS4chwICSgLx1mRd6kM';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

/**
 * Convert an image URL to base64
 */
async function imageUrlToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

/**
 * Generate a virtual try-on image using Gemini
 * @param {Array} products - Array of selected products with imageUrl, name, category
 * @returns {Promise<Object>} - Object with imageData (base64) and mimeType
 */
export async function generateTryOnImage(products) {
  if (!products || products.length === 0) {
    throw new Error('No products provided for try-on');
  }

  // Convert all product images to base64 so Gemini can see the actual items
  const productImagesPromises = products.map(async (p) => {
    try {
      const base64 = await imageUrlToBase64(p.imageUrl);
      return { product: p, base64 };
    } catch (err) {
      console.warn(`Failed to load image for ${p.name}:`, err);
      return { product: p, base64: null };
    }
  });

  const productImages = await Promise.all(productImagesPromises);

  // Build the prompt with reference to the images
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

  for (const { product, base64 } of productImages) {
    if (base64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64
        }
      });
      parts.push({ text: `(Above: ${product.name} - ${product.category})` });
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

  try {
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
      throw new Error(errorData.error?.message || 'Failed to generate image');
    }

    const data = await response.json();

    // Extract the generated image from the response
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

    throw new Error('No image generated in response');
  } catch (error) {
    console.error('Error generating try-on image:', error);
    throw error;
  }
}

/**
 * Edit an existing image with clothing items
 * @param {string} baseImageUrl - URL of the model image to edit
 * @param {Array} products - Array of products to add to the image
 * @returns {Promise<Object>} - Object with imageData (base64) and mimeType
 */
export async function editImageWithClothing(baseImageUrl, products) {
  if (!baseImageUrl) {
    throw new Error('Base image URL is required');
  }

  const base64Image = await imageUrlToBase64(baseImageUrl);
  const productDescriptions = products.map(p => `${p.name} (${p.category})`).join(', ');

  const prompt = `Edit this image to show the person wearing: ${productDescriptions}. Keep the same pose and background, but change their outfit to match these clothing items. Make it look natural and realistic.`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to edit image');
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

    throw new Error('No image generated in response');
  } catch (error) {
    console.error('Error editing image:', error);
    throw error;
  }
}

export default {
  generateTryOnImage,
  editImageWithClothing
};
