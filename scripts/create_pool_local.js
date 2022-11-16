const { deployPool } = require("./create_pool");

deployPool(
  2,
  "Test Pool",
  60 * 60 * 24,
  [
    'Team1',
    'Team2',
  ]
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});