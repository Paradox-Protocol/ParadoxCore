const { main } = require('./deploy');

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});