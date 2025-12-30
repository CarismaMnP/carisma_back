async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

const generatePaymentToken = async (
  TerminalKey,
  Amount,
  OrderId,
  Description,
  Password,
  SuccessURL,
) => {
  const paymentData = [
    { TerminalKey },
    { Amount },
    { OrderId },
    { Description },
    { Password },
    { SuccessURL },
  ];
  paymentData.sort((a, b) => {
    const keyA = Object.keys(a)[0];
    const keyB = Object.keys(b)[0];
    return keyA.localeCompare(keyB);
  });
  const concatenatedValues = paymentData.map(obj => Object.values(obj)[0]).join('');
  const token = await sha256(concatenatedValues);
  return token;
};

module.exports = generatePaymentToken;
