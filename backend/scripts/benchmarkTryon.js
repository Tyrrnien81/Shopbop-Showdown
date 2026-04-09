/**
 * Benchmark: measures try-on image generation latency.
 *
 * Prerequisites:
 *   - Backend server running on localhost:3000  (cd backend && npm run dev)
 *   - GEMINI_API_KEY set in backend/.env
 *
 * Usage:
 *   node scripts/benchmarkTryon.js            # default 3 images
 *   node scripts/benchmarkTryon.js --count 1  # single image
 */

const BACKEND_URL = 'http://localhost:3000';

// ── helpers ────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function imageUrlToBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString('base64');
}

// ── main ───────────────────────────────────────────────────────

async function main() {
  const count = process.argv.includes('--count')
    ? parseInt(process.argv[process.argv.indexOf('--count') + 1], 10)
    : 3;

  console.log('='.repeat(55));
  console.log(' Try-On Image Generation Benchmark');
  console.log('='.repeat(55));

  // 1. Health check
  try {
    await fetchJson(`${BACKEND_URL}/api/health`);
    console.log('\n[1/4] Backend health check: OK');
  } catch {
    console.error('\n[ERROR] Backend not reachable at', BACKEND_URL);
    console.error('        Start it first:  cd backend && npm run dev');
    process.exit(1);
  }

  // 2. Search for products
  console.log('[2/4] Searching Shopbop for test products...');
  const searchStart = Date.now();
  const { products } = await fetchJson(
    `${BACKEND_URL}/api/products/search?query=dress&limit=3`
  );
  const searchMs = Date.now() - searchStart;
  console.log(`      Found ${products.length} products (${searchMs}ms)`);

  if (products.length === 0) {
    console.error('[ERROR] No products found — cannot benchmark.');
    process.exit(1);
  }

  products.forEach((p, i) =>
    console.log(`      ${i + 1}. ${p.name} ($${p.price}) — ${p.category}`)
  );

  // 3. Convert images to base64
  console.log('[3/4] Converting product images to base64...');
  const imgStart = Date.now();
  const productImages = [];
  for (const p of products) {
    try {
      const base64 = await imageUrlToBase64(p.imageUrl);
      productImages.push({ base64, mimeType: 'image/jpeg' });
      console.log(`      ${p.name}: ${(base64.length / 1024).toFixed(0)}KB base64`);
    } catch (err) {
      console.warn(`      ${p.name}: FAILED (${err.message})`);
      productImages.push({ base64: null, mimeType: null });
    }
  }
  const imgMs = Date.now() - imgStart;
  console.log(`      Image conversion done (${imgMs}ms)`);

  // 4. Call try-on endpoint and measure
  console.log(`[4/4] Generating ${count} try-on image(s)... (this may take a while)`);
  console.log('');

  const payload = {
    products: products.map(p => ({
      name: p.name,
      category: p.category,
      brand: p.brand,
    })),
    productImages,
    count,
  };

  const payloadSize = Buffer.byteLength(JSON.stringify(payload));
  console.log(`      Request payload size: ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);

  const genStart = Date.now();
  const res = await fetch(`${BACKEND_URL}/api/tryon/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const genMs = Date.now() - genStart;

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`\n[ERROR] Generation failed: ${res.status}`, err.error || '');
    process.exit(1);
  }

  const data = await res.json();
  const imageCount = data.images?.length ?? 0;

  // ── results ──────────────────────────────────────────────────
  console.log('');
  console.log('='.repeat(55));
  console.log(' RESULTS');
  console.log('='.repeat(55));
  console.log(`  Images requested : ${count}`);
  console.log(`  Images generated : ${imageCount}`);
  console.log(`  Product search   : ${searchMs}ms`);
  console.log(`  Image conversion : ${imgMs}ms`);
  console.log(`  Generation time  : ${(genMs / 1000).toFixed(1)}s`);
  console.log(`  Per-image avg    : ${(genMs / imageCount / 1000).toFixed(1)}s`);
  console.log(`  Payload size     : ${(payloadSize / 1024 / 1024).toFixed(2)}MB`);
  console.log('='.repeat(55));
  console.log('');
  console.log('This is the BASELINE (sequential + 2s delays).');
  console.log('After Phase 1 (parallel), expect ~3-5s total.');
  console.log('After Phase 2 (Lambda),  expect ~3-5s + server offload.');
}

main().catch(err => {
  console.error('Benchmark failed:', err.message);
  process.exit(1);
});
