/**
 * Deploy the try-on Lambda function to AWS.
 *
 * Prerequisites:
 *   - AWS credentials in .env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
 *   - TRYON_LAMBDA_ROLE in .env (IAM role ARN for Lambda execution)
 *   - GEMINI_API_KEY in .env (passed to Lambda as environment variable)
 *
 * Usage:
 *   node scripts/deployLambda.js
 *   npm run deploy:lambda
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  LambdaClient,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
} = require('@aws-sdk/client-lambda');

// ── Configuration ──────────────────────────────────────────────
const FUNCTION_NAME = 'shopbop-tryon-generate';
const LAMBDA_DIR = path.join(__dirname, '..', 'lambda', 'tryon-generate');
const ZIP_PATH = path.join(__dirname, '..', 'tryon-generate.zip');
const REGION = process.env.AWS_REGION || 'us-east-1';
const ROLE_ARN = process.env.TRYON_LAMBDA_ROLE;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const LAMBDA_CONFIG = {
  Runtime: 'nodejs20.x',
  Handler: 'index.handler',
  Timeout: 30,
  MemorySize: 512,
};

const client = new LambdaClient({ region: REGION });

// ── Helpers ────────────────────────────────────────────────────
function validatePrerequisites() {
  const errors = [];
  if (!ROLE_ARN) errors.push('TRYON_LAMBDA_ROLE not set in .env — create an IAM role for Lambda and add its ARN');
  if (!GEMINI_KEY) errors.push('GEMINI_API_KEY not set in .env');
  if (!fs.existsSync(path.join(LAMBDA_DIR, 'index.js'))) errors.push('lambda/tryon-generate/index.js not found');

  if (errors.length > 0) {
    errors.forEach(e => console.error(`[ERROR] ${e}`));
    process.exit(1);
  }
}

function createZipArchive() {
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  execSync(`cd "${LAMBDA_DIR}" && zip -j "${ZIP_PATH}" index.js package.json`, { stdio: 'pipe' });
  const zipSize = fs.statSync(ZIP_PATH).size;
  console.log(`  Archive: ${(zipSize / 1024).toFixed(1)}KB`);
  return fs.readFileSync(ZIP_PATH);
}

function cleanup() {
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
}

async function functionExists() {
  try {
    await client.send(new GetFunctionCommand({ FunctionName: FUNCTION_NAME }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function createFunction(zipBuffer) {
  const result = await client.send(new CreateFunctionCommand({
    FunctionName: FUNCTION_NAME,
    ...LAMBDA_CONFIG,
    Role: ROLE_ARN,
    Code: { ZipFile: zipBuffer },
    Environment: {
      Variables: { GEMINI_API_KEY: GEMINI_KEY },
    },
  }));
  console.log(`  Created: ${result.FunctionArn}`);
}

async function updateFunction(zipBuffer) {
  await client.send(new UpdateFunctionCodeCommand({
    FunctionName: FUNCTION_NAME,
    ZipFile: zipBuffer,
  }));
  console.log('  Code updated');

  // Wait briefly for code update to propagate before updating config
  await new Promise(resolve => setTimeout(resolve, 2000));

  await client.send(new UpdateFunctionConfigurationCommand({
    FunctionName: FUNCTION_NAME,
    ...LAMBDA_CONFIG,
    Environment: {
      Variables: { GEMINI_API_KEY: GEMINI_KEY },
    },
  }));
  console.log('  Configuration updated (env vars, timeout, memory)');
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(50));
  console.log(' Lambda Deployment: shopbop-tryon-generate');
  console.log('='.repeat(50));

  // 1. Validate
  validatePrerequisites();

  // 2. Create zip
  console.log('\n[1/3] Creating zip archive...');
  const zipBuffer = createZipArchive();

  // 3. Check if function exists
  console.log('\n[2/3] Checking if function exists...');
  const exists = await functionExists();
  console.log(exists ? '  Function exists — will update' : '  Function not found — will create');

  // 4. Create or update
  console.log(`\n[3/3] ${exists ? 'Updating' : 'Creating'} function...`);
  if (exists) {
    await updateFunction(zipBuffer);
  } else {
    await createFunction(zipBuffer);
  }

  // 5. Cleanup
  cleanup();

  console.log('\n' + '='.repeat(50));
  console.log(' Deployment complete!');
  console.log('');
  console.log(' Next steps:');
  console.log(`   1. Add TRYON_LAMBDA_NAME=${FUNCTION_NAME} to .env`);
  console.log('   2. Restart the backend server');
  console.log('   3. Run: node scripts/benchmarkTryon.js');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('\nDeployment failed:', err.message);
  cleanup();
  process.exit(1);
});
