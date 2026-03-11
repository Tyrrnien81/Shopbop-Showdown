const gamesTable = require('./gamesTable');
const playersTable = require('./playersTable');
const outfitsTable = require('./outfitsTable');
const votesTable = require('./votesTable');

module.exports = {
  ...gamesTable,
  ...playersTable,
  ...outfitsTable,
  ...votesTable,
};
