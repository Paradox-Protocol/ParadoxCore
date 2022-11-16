const { main } = require('./deploy');

main(true, "0x77700005BEA4DE0A78b956517f099260C2CA9a26").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});