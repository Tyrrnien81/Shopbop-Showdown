// Usage: cd backend && node scripts/setupS3Bucket.js
// Creates the outfit image bucket (if missing) and configures it for public read.
// Idempotent — safe to re-run.

require('dotenv').config();
const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutPublicAccessBlockCommand,
  PutBucketPolicyCommand,
  PutBucketOwnershipControlsCommand,
} = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET = process.env.S3_BUCKET_NAME || 'shopbop-showdown-outfits';

const s3 = new S3Client({
  region: REGION,
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

async function bucketExists() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return true;
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return false;
    if (e.$metadata?.httpStatusCode === 403) {
      throw new Error(`Bucket "${BUCKET}" exists but belongs to another AWS account. Pick a different S3_BUCKET_NAME.`);
    }
    throw e;
  }
}

async function createBucket() {
  const params = { Bucket: BUCKET };
  if (REGION !== 'us-east-1') {
    params.CreateBucketConfiguration = { LocationConstraint: REGION };
  }
  await s3.send(new CreateBucketCommand(params));
}

async function configurePublicRead() {
  await s3.send(new PutBucketOwnershipControlsCommand({
    Bucket: BUCKET,
    OwnershipControls: {
      Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
    },
  }));

  await s3.send(new PutPublicAccessBlockCommand({
    Bucket: BUCKET,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false,
    },
  }));

  const policy = {
    Version: '2012-10-17',
    Statement: [{
      Sid: 'PublicReadOutfitImages',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${BUCKET}/*`,
    }],
  };

  await s3.send(new PutBucketPolicyCommand({
    Bucket: BUCKET,
    Policy: JSON.stringify(policy),
  }));
}

async function main() {
  console.log(`Setting up S3 bucket "${BUCKET}" in ${REGION}...`);

  if (await bucketExists()) {
    console.log(`Bucket already exists: ${BUCKET}`);
  } else {
    await createBucket();
    console.log(`Created bucket: ${BUCKET}`);
  }

  await configurePublicRead();
  console.log('Configured bucket for public read.');
  console.log(`Objects will be accessible at: https://${BUCKET}.s3.${REGION}.amazonaws.com/<key>`);
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
