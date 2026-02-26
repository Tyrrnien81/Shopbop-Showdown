import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "us-east-1" });

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

for (const table of tables) {
  try {
    await client.send(new CreateTableCommand(table));
    console.log(`✅ Created: ${table.TableName}`);
  } catch (e) {
    if (e.name === "ResourceInUseException") {
      console.log(`⚠️  Already exists: ${table.TableName}`);
    } else {
      throw e;
    }
  }
}