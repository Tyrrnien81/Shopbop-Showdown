const { PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
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

module.exports = { createVote, getVotesByGameId };
