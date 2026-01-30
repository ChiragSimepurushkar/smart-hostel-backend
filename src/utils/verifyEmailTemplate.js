const VerificationEmail = (username, otp) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SmartWard Email Verification</title>
      <style>
        .container {
          max-width: 600px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          border: 1px solid #eee;
          border-radius: 8px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #4CAF50;
          padding-bottom: 10px;
        }
        .header h1 {
          color: #4CAF50;
          font-size: 24px;
        }
        .content {
          text-align: center;
          padding: 30px 20px;
        }
        .content p {
          font-size: 16px;
          line-height: 1.6;
          color: #333;
        }
        .otp {
          font-size: 32px;
          font-weight: bold;
          color: #4CAF50;
          margin: 20px 0;
          padding: 15px 30px;
          border: 2px dashed #4CAF50;
          display: inline-block;
          letter-spacing: 5px;
          background-color: #f9f9f9;
        }
        .footer {
          text-align: center;
          font-size: 12px;
          color: #999;
          margin-top: 30px;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SmartWard</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${username}</strong>,</p>
          <p>Welcome to <strong>SmartWard</strong>, your intelligent hostel management partner. Please use the verification code below to complete your registration:</p>
          <div class="otp">${otp}</div>
          <p>This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 SmartWard Management Systems. All rights reserved.</p>
          <p>Helping you build a smarter, safer hostel community.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export default VerificationEmail;