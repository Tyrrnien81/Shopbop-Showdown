const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET_NAME || 'shopbop-showdown-outfits';

const s3Client = new S3Client({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

function isConfigured() {
  return !!BUCKET && !!process.env.AWS_ACCESS_KEY_ID;
}

function getImageUrl(key) {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

function stripDataUrlPrefix(input) {
  if (typeof input !== 'string') return { data: input, mimeType: 'image/png' };
  const match = input.match(/^data:(.+?);base64,(.+)$/);
  if (match) return { data: match[2], mimeType: match[1] };
  return { data: input, mimeType: 'image/png' };
}

async function uploadImage(base64Data, key) {
  if (!base64Data) throw new Error('uploadImage: base64Data is required');
  if (!key) throw new Error('uploadImage: key is required');

  const { data, mimeType } = stripDataUrlPrefix(base64Data);
  const buffer = Buffer.from(data, 'base64');

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=300',
  }));

  return getImageUrl(key);
}

module.exports = {
  s3Client,
  uploadImage,
  getImageUrl,
  isConfigured,
  BUCKET,
  REGION,
};
