const { GetCommand, PutCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');

const TABLE = 'Players';

async function getPlayer(playerId) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { playerId },
  }));
  return Item || null;
}

async function createPlayer(player) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: player,
  }));
  return player;
}

async function getPlayersByGameId(gameId) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'gameId-index',
    KeyConditionExpression: 'gameId = :gid',
    ExpressionAttributeValues: { ':gid': gameId },
  }));
  return Items || [];
}

async function updatePlayer(playerId, fields) {
  const parts = [];
  const values = {};

  for (const [key, val] of Object.entries(fields)) {
    parts.push(`${key} = :${key}`);
    values[`:${key}`] = val;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { playerId },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return Attributes;
}

module.exports = { getPlayer, createPlayer, getPlayersByGameId, updatePlayer };
