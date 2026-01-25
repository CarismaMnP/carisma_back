const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_LOGIN,
    pass: process.env.SMTP_PASS,
  },
});



/**
 * Send verification code email for login
 * @param {string} email - Recipient email
 * @param {string} code - Verification code
 */
async function sendVerificationCode(email, code) {
  console.log("sendVerificationCode")
  console.log(process.env.SMTP_LOGIN)
  console.log(process.env.SMTP_PASS)
  const mailOptions = {
    from: '"CARisma M&P" <info@mailer.carismamp.com>',
    to: email,
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to CARisma M&P</h2>
        <p>Your verification code is:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333;">${code}</span>
        </div>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">Carisma Auto Parts</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification code sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

/**
 * Send order confirmation email
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.orderId - Order ID
 * @param {string} params.fullName - Customer name
 * @param {Array} params.products - Array of ordered products
 * @param {number} params.subtotal - Subtotal amount
 * @param {number} params.tax - Tax amount
 * @param {number} params.total - Total amount
 * @param {Object} params.shippingAddress - Shipping address (optional)
 */
async function sendOrderConfirmation({ email, orderId, fullName, products, subtotal, tax, total, shippingAddress }) {
  const productRows = products.map(p => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${p.count}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${(p.price * p.count).toFixed(2)}</td>
    </tr>
  `).join('');

  const shippingSection = shippingAddress ? `
    <div style="margin-top: 20px;">
      <h3 style="color: #333; margin-bottom: 10px;">Shipping Address</h3>
      <p style="margin: 0; color: #555;">
        ${shippingAddress.name || fullName}<br>
        ${shippingAddress.line1}<br>
        ${shippingAddress.line2 ? shippingAddress.line2 + '<br>' : ''}
        ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postal_code}<br>
        ${shippingAddress.country}
      </p>
    </div>
  ` : '';

  const mailOptions = {
    from: '"CARisma M&P" <info@mailer.carismamp.com>',
    to: email,
    subject: `Order Confirmation #${orderId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Thank You for Your Order!</h2>
        <p>Hi ${fullName},</p>
        <p>We've received your order and it's being processed. Here are the details:</p>

        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0;"><strong>Order Number:</strong> #${orderId}</p>
        </div>

        <h3 style="color: #333;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f4f4f4;">
              <th style="padding: 10px; text-align: left;">Product</th>
              <th style="padding: 10px; text-align: center;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>

        <div style="margin-top: 20px; text-align: right;">
          <p style="margin: 5px 0;"><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Tax:</strong> $${tax.toFixed(2)}</p>
          <p style="margin: 5px 0; font-size: 18px;"><strong>Total:</strong> $${total.toFixed(2)}</p>
        </div>

        ${shippingSection}

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p>If you have any questions about your order, please contact us.</p>
        <p style="color: #888; font-size: 12px;">Carisma Auto Parts</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation sent to ${email} for order ${orderId}`);
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    throw error;
  }
}

/**
 * Send client part request email to business
 * @param {Object} params - Request parameters
 * @param {string} params.make - Car make (BMW, Audi, etc.)
 * @param {string} params.model - Car model
 * @param {string} params.generation - Car generation
 * @param {string} params.email - Client email
 * @param {string} params.partDescription - Description of the part they're looking for
 */
async function sendClientRequest({ make, model, generation, email, partDescription }) {
  const mailOptions = {
    from: '"CARisma M&P Website" <info@mailer.carismamp.com>',
    to: 'info@carismamp.com',
    subject: 'New Client Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Part Request</h2>
        <p>A customer is looking for a part:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold; width: 30%;">Make</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${make || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Model</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${model || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Generation</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${generation || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Email</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><a href="mailto:${email}">${email || 'Not specified'}</a></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9; font-weight: bold;">Part Description</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${partDescription || 'Not specified'}</td>
          </tr>
        </table>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #888; font-size: 12px;">This request was submitted via the CARisma M&P website.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Client request sent from ${email}`);
  } catch (error) {
    console.error('Error sending client request email:', error);
    throw error;
  }
}

module.exports = {
  sendVerificationCode,
  sendOrderConfirmation,
  sendClientRequest,
};
