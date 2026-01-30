// utils/generatedRefreshToken.js
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model.js';

const generatedRefreshToken = async (userId) => {
  try {
    const payload = {
      userId: userId,
      id: userId
    };

    const token = jwt.sign(
      payload,
      process.env.SECRET_KEY_REFRESH_TOKEN,  // Different secret for refresh
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    await UserModel.findByIdAndUpdate(userId, {
      refresh_token: token
    });

    return token;
  } catch (error) {
    console.error('Generate refresh token error:', error);
    throw error;
  }
};

export default generatedRefreshToken;