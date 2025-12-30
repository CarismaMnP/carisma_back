const getPluralNoun = (num, wordVariants) => {
  return wordVariants[getNounPluralForm(num)];
};

function getNounPluralForm(a) {
  if (a % 10 === 1 && a % 100 !== 11) {
    return 0;
  } else if (a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 10 || a % 100 >= 20)) {
    return 1;
  } else {
    return 2;
  }
}

module.exports = getPluralNoun;
