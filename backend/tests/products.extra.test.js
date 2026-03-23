const request = require("supertest");
const { app } = require("../server");

describe("Additional Product APIs", () => {

  const realFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  test("GET /api/products/:productSin returns normalized product", async () => {

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        productSin: "123456",
        shortDescription: "Test Jacket",
        designerName: "Test Brand",
        retailPrice: { usdPrice: 250 },
        colors: [{ images: [{ src: "/prod/products/test.jpg" }] }],
        categoryName: "Outerwear"
      })
    });

    const res = await request(app)
      .get("/api/products/123456");

    expect(res.status).toBe(200);

    const product = res.body;

    expect(product.productSin).toBe("123456");
    expect(product.name).toBe("Test Jacket");
    expect(product.brand).toBe("Test Brand");
    expect(typeof product.price).toBe("number");
    expect(typeof product.imageUrl).toBe("string");

  });

  test("GET /api/categories returns categories list", async () => {

    const res = await request(app)
      .get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("categories");
    expect(Array.isArray(res.body.categories)).toBe(true);

  });

});