const { PutCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('./dynamoClient');

const TABLE = 'Votes';

async function createVote(vote) {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: vote,
  }));
  return vote;
}

async function getVotesByGameId(gameId) {
  const { Items } = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'gameId-index',
    KeyConditionExpression: 'gameId = :gid',
    ExpressionAttributeValues: { ':gid': gameId },
  }));
  return Items || [];
}

async function scanAllVotes() {
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

module.exports = { createVote, getVotesByGameId, scanAllVotes };
