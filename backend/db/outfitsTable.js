const { GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');

const TABLE = 'Outfits';

async function getOutfit(outfitId) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { outfitId },
  }));
  return Item || null;
}

async function createOutfit(outfit) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: outfit,
  }));
  return outfit;
}

async function updateOutfit(outfitId, fields) {
  const parts = [];
  const values = {};

  for (const [key, val] of Object.entries(fields)) {
    parts.push(`${key} = :${key}`);
    values[`:${key}`] = val;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { outfitId },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return Attributes;
}

async function getOutfitsByGameId(gameId) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'gameId-index',
    KeyConditionExpression: 'gameId = :gid',
    ExpressionAttributeValues: { ':gid': gameId },
  }));
  return Items || [];
}

async function scanAllOutfits() {
  const items = [];
  let lastKey;
  do {
    const params = { TableName: TABLE };
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const { Items, LastEvaluatedKey } = await docClient.send(new ScanCommand(params));
    items.push(...(Items || []));
    lastKey = LastEvaluatedKey;
  } while (lastKey);
  return items;
}

module.exports = { getOutfit, createOutfit, updateOutfit, getOutfitsByGameId, scanAllOutfits };
