# Shopbop UW Capstone Common API Calls - 2025

---

## Images

- **Base URL:** `https://api.shopbop.com`
- **Base URL for images:** `https://m.media-amazon.com/images/G/01/Shopbop/p`
- **URL suffix for images:** found in response of Search API call, with schema `response.products[product_index].colors.images[image_index]`

---

## HTTP Information

**HTTP Methods:** All API calls listed here are GET's.

### Headers

| Header           | Value                          | Description                                                    |
| ---------------- | ------------------------------ | -------------------------------------------------------------- |
| `Accept`         | `application/json`             | Basic HTTP header to specify what MIME types the client can understand |
| `Client-Id`      | `Shopbop-UW-<Team Num>-2024`  | String identifying the client calling the API. e.g., `Shopbop-UW-Team1-2024` & `Shopbop-UW-Team2-2024` |
| `Client-Version` | `1.0.0`                        | String identifying the version of the client calling the API   |

---

## API Calls

### SEARCH

**Description:** Browse products by search keyword

**Endpoint:** `GET /public/search`

#### Parameters

| Query Parameter        | Type   | Definition                                             | Possible Values                                                                    |
| ---------------------- | ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `q`                    | String | A search term **(required)**                           |                                                                                    |
| `allowOutOfStockItems` | String | Whether out of stock products are returned             | `"false"`, `"true"`                                                                |
| `sort`                 | String | Sort type                                              | `editors-pick`, `exclusives`, `hearts`, `price-high-low`, `price-low-high`, `ratings` |
| `minPrice`             | String | Minimum price                                          |                                                                                    |
| `maxPrice`             | String | Maximum price                                          |                                                                                    |
| `limit`                | Int32  | Limit results                                          |                                                                                    |
| `offset`               | Int32  | Defines the product the responses should start with    |                                                                                    |
| `dept`                 | String | Department ID                                          | `"WOMENS"`, `"MENS"`                                                               |
| `lang`                 | String | Language or locale                                     | `"en-US"`, `"zh-CN"`, `"ru-RU"`                                                   |

#### Example

```bash
curl -X 'GET' \
  'https://api.shopbop.com/public/search?lang=en-US&currency=USD&q=jeans&limit=40&minPrice=25&maxPrice=500&siteId=1006&allowOutOfStockItems=false&dept=WOMENS' \
  -H 'accept: application/json' \
  -H 'Client-Id: Shopbop-UW-Team1-2024' \
  -H 'Client-Version: 1.0.0'
```

---

### CATEGORIES

**Description:** Get public folders. This API call will return a navigation tree, the leaves of which are called categories. Each category has products associated with it. If you would like to build some sort of navigation within your project to get to a screen with a list of products, this is the call you want to use.

**Endpoint:** `GET /public/folders`

#### Parameters

| Query Parameter | Type   | Definition       | Possible Values                        |
| --------------- | ------ | ---------------- | -------------------------------------- |
| `dept`          | String | Department ID    | `"WOMENS"`, `"MENS"`                  |
| `lang`          | String | Language/locale  | `"en-US"`, `"zh-CN"`, `"ru-RU"`       |

#### Example

```bash
curl -X 'GET' \
  'https://api.shopbop.com/public/folders?lang=en-US&dept=WOMENS' \
  -H 'accept: application/json' \
  -H 'Client-Id: Shopbop-UW-Team1-2024' \
  -H 'Client-Version: 1.0.0'
```

---

### BROWSE BY CATEGORY

**Description:** Retrieve browse products for a given category (obtained from the Categories call above).

**Endpoint:** `GET /public/categories/{categoryId}/products`

#### Parameters

| Parameter              | Type   | Param Type | Definition                                              | Possible Values                                                                    |
| ---------------------- | ------ | ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `categoryId`           | String | Path       | Category Id **(required)**                              |                                                                                    |
| `allowOutOfStockItems` | String | Query      | Whether out of stock products are returned              | `"false"`, `"true"`                                                                |
| `lang`                 | String | Query      | Language or locale                                      | `"en-US"`, `"zh-CN"`, `"ru-RU"`                                                   |
| `colors`               | String | Query      | Refine results to include only products in these colors | e.g., Black, Blue, White                                                           |
| `sort`                 | String | Query      | Sort type                                               | `editors-pick`, `exclusives`, `hearts`, `price-high-low`, `price-low-high`, `ratings` |
| `minPrice`             | String | Query      | Minimum price                                           |                                                                                    |
| `maxPrice`             | String | Query      | Maximum price                                           |                                                                                    |
| `limit`                | Int32  | Query      | Limit results                                           |                                                                                    |
| `offset`               | Int32  | Query      | Defines the product the responses should start with     |                                                                                    |
| `dept`                 | String | Query      | Department ID                                           | `"WOMENS"`, `"MENS"`                                                               |
| `q`                    | String | Query      | Search string to apply within category                  |                                                                                    |

#### Example

```bash
curl -X 'GET' \
  'https://api.shopbop.com/public/categories/13198/products?lang=en-US&currency=USD&limit=40&q=shoes&minPrice=25&maxPrice=500&dept=WOMENS' \
  -H 'accept: application/json' \
  -H 'Client-Id: Shopbop-UW-Team1-2024' \
  -H 'Client-Version: 1.0.0'
```

---

### GET PRODUCT DETAILS

**Description:** Get details for a particular product given a product ID.

**Endpoint:** `GET /public/products/{productSins}`

#### Parameters

| Parameter     | Type   | Param Type | Definition                                              | Possible Values                  |
| ------------- | ------ | ---------- | ------------------------------------------------------- | -------------------------------- |
| `productSins` | String | Path       | Comma separated list of SINs — works at style/color/size levels |                                  |
| `lang`        | String | Query      | Language or locale                                      | `"en-US"`, `"zh-CN"`, `"ru-RU"` |

#### Example

```bash
curl -X 'GET' \
  'https://api.shopbop.com/public/products/1547795609,1564465741,1502880995?lang=en-US' \
  -H 'accept: application/json' \
  -H 'Client-Id: Shopbop-UW-Team1-2024' \
  -H 'Client-Version: 1.0.0'
```

---

### OUTFITS

**Description:** Retrieve outfits that include the specified product. The response will include all active colors for the product. Any colors without outfits will have an empty outfits list.

**Endpoint:** `GET /public/products/{productSin}/outfits`

#### Parameters

| Parameter    | Type   | Param Type | Definition              | Possible Values                  |
| ------------ | ------ | ---------- | ----------------------- | -------------------------------- |
| `productSin` | String | Path       | SIN of the product      |                                  |
| `lang`       | String | Query      | Language or locale      | `"en-US"`, `"zh-CN"`, `"ru-RU"` |

#### Example

```bash
curl -X 'GET' \
  'https://api.shopbop.com/public/products/1569471937/outfits?lang=en-US' \
  -H 'accept: application/json' \
  -H 'Client-Id: Shopbop-UW-Team1-2024' \
  -H 'Client-Version: 1.0.0'
```

---

## CORS Errors

While calling the API from your application code in a browser, you may run into a Cross Origin Resource Sharing (CORS) error. Browsers enforce CORS to prevent websites from making calls to a different domain for security purposes.

**References:**
- https://aws.amazon.com/what-is/cross-origin-resource-sharing
- https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

### Recommended Mitigation Strategies

1. **Server-side API calls** — Make your Shopbop API calls on the server-side of your application (i.e. when running a Lambda), and provide the API response to the browser.
2. **Client-side proxy** — Proxy API calls on the client-side through your domain.
   - This can be accomplished with an AWS API Gateway that runs on the same domain as your website (e.g., `api.myproject.com`). You can configure this gateway to forward the browser's request to the Shopbop API.
