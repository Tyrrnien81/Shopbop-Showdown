const { GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
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

module.exports = { getOutfit, createOutfit, updateOutfit, getOutfitsByGameId };
