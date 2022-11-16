const { main } = require('./deploy');

main(true).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});