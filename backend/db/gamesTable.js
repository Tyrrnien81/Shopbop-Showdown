const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');

const TABLE = 'Games';

async function getGame(gameId) {
  const { Item } = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { gameId },
  }));
  return Item || null;
}

async function createGame(game) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: game,
    ConditionExpression: 'attribute_not_exists(gameId)',
  }));
  return game;
}

async function appendPlayerId(gameId, playerId) {
  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { gameId },
    UpdateExpression: 'SET playerIds = list_append(playerIds, :newId)',
    ExpressionAttributeValues: { ':newId': [playerId] },
    ReturnValues: 'ALL_NEW',
  }));
  return Attributes;
}

async function updateGameStatus(gameId, status, extraFields = {}) {
  const parts = ['#s = :status'];
  const names = { '#s': 'status' };
  const values = { ':status': status };

  for (const [key, val] of Object.entries(extraFields)) {
    parts.push(`${key} = :${key}`);
    values[`:${key}`] = val;
  }

  const { Attributes } = await docClient.send(new UpdateCommand({
    TableName: TABLE,
    Key: { gameId },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return Attributes;
}

module.exports = { getGame, createGame, appendPlayerId, updateGameStatus };
