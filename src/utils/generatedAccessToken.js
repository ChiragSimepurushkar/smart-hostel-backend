// utils/generatedAccessToken.js
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model.js';

const generatedAccessToken = async (userId) => {
  try {
    // Create token payload
    const payload = {
      userId: userId,  // Make sure this is consistent
      id: userId       // Some code might use 'id' instead
    };

    // Sign token
    const token = jwt.sign(
      payload,
      process.env.SECRET_KEY_ACCESS_TOKEN,  // MUST match env variable
      { expiresIn: '1d' }  // or '24h', '1h', etc.
    );

    return token;
  } catch (error) {
    console.error('Generate access token error:', error);
    throw error;
  }
};

export default generatedAccessToken;