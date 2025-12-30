const calculateSum = (obj, field) => obj
  .map(items => items.attributes[field])
  .reduce((prev, curr) => prev + curr, 0);

module.exports = calculateSum 