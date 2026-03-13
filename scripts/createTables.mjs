// Run from project root: node --env-file=backend/.env scripts/createTables.mjs
// Or from backend dir:   cd backend && node --env-file=.env ../scripts/createTables.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load .env from backend/ if not already loaded
try { require('dotenv').config({ path: new URL('../backend/.env', import.meta.url).pathname }); } catch {}

import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  ...(process.env.AWS_ACCESS_KEY_ID && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  }),
});

const tables = [
  {
    TableName: "Games",
    KeySchema: [{ AttributeName: "gameId", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "gameId", AttributeType: "S" }],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "Players",
    KeySchema: [{ AttributeName: "playerId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "playerId", AttributeType: "S" },
      { AttributeName: "gameId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "gameId-index",
        KeySchema: [{ AttributeName: "gameId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "Outfits",
    KeySchema: [{ AttributeName: "outfitId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "outfitId", AttributeType: "S" },
      { AttributeName: "gameId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "gameId-index",
        KeySchema: [{ AttributeName: "gameId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
  {
    TableName: "Votes",
    KeySchema: [{ AttributeName: "voteId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "voteId", AttributeType: "S" },
      { AttributeName: "gameId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "gameId-index",
        KeySchema: [{ AttributeName: "gameId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  },
];

console.log(`Creating tables in region: ${process.env.AWS_REGION || 'us-east-1'}...`);

for (const table of tables) {
  try {
    await client.send(new CreateTableCommand(table));
    console.log(`Created: ${table.TableName}`);
  } catch (e) {
    if (e.name === "ResourceInUseException") {
      console.log(`Already exists: ${table.TableName}`);
    } else {
      console.error(`Failed to create ${table.TableName}:`, e.message);
      throw e;
    }
  }
}

console.log('Done!');
