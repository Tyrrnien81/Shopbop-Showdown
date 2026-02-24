// Gemini API service - calls backend proxy (API key is kept secret on server)

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

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
 * Generate a virtual try-on image using the backend proxy
 * @param {Array} products - Array of selected products with imageUrl, name, category
 * @returns {Promise<Object>} - Object with imageData (base64) and mimeType
 */
export async function generateTryOnImage(products) {
  if (!products || products.length === 0) {
    throw new Error('No products provided for try-on');
  }

  // Convert all product images to base64
  const productImagesPromises = products.map(async (p) => {
    try {
      const base64 = await imageUrlToBase64(p.imageUrl);
      return { base64, mimeType: 'image/jpeg' };
    } catch (err) {
      console.warn(`Failed to load image for ${p.name}:`, err);
      return { base64: null, mimeType: null };
    }
  });

  const productImages = await Promise.all(productImagesPromises);

  try {
    const response = await fetch(`${BACKEND_URL}/api/tryon/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: products.map(p => ({
          name: p.name,
          category: p.category,
          brand: p.brand
        })),
        productImages: productImages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate image');
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating try-on image:', error);
    throw error;
  }
}

export default {
  generateTryOnImage
};
