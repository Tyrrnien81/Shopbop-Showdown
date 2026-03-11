const { GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
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

async function getOutfitsByGameId(gameId) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'gameId-index',
    KeyConditionExpression: 'gameId = :gid',
    ExpressionAttributeValues: { ':gid': gameId },
  }));
  return Items || [];
}

module.exports = { getOutfit, createOutfit, getOutfitsByGameId };
