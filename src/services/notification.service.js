import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';
import { sendEmail } from './email.service.js';
import { sendSMS } from './sms.service.js';
import { getIO } from '../socket/index.js';

class NotificationService {
  /**
   * Send notification to a specific user
   */
  async notifyUser({ userId, type, title, message, entityType, entityId }) {
    try {
      // 1. Create notification in MongoDB
      const notification = await Notification.create({
        user: userId,
        type,
        title,
        message,
        entityType,
        entityId,
      });

      // 2. Get user preferences
      const user = await User.findById(userId).select('email phone fullName');
      if (!user) return;

      // 3. Send real-time notification via Socket.io
      try {
        const io = getIO();
        io.to(`user:${userId}`).emit('notification', notification);
      } catch (err) {
        console.log('⏳ Socket standby...');
      }

      // 4. Send email notification
      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: title,
          html: this.getEmailTemplate(title, message, entityType, entityId),
        });
      }

      // 5. Send SMS for high-priority notifications
      if (type === 'ISSUE_CREATED' && user.phone) {
        await sendSMS({
          to: user.phone,
          message: `SmartWard: ${message}`,
        });
      }

      return notification;
    } catch (error) {
      console.error('❌ Notify user error:', error);
    }
  }

  /**
   * Send notification to all management users of a hostel
   */
  async notifyManagement({ type, title, message, entityType, entityId, hostelId }) {
    try {
      const managementUsers = await User.find({
        role: { $in: ['MANAGEMENT', 'ADMIN'] },
        hostel: hostelId || { $exists: true },
        isActive: true,
      }).select('_id');

      const promises = managementUsers.map(user =>
        this.notifyUser({
          userId: user._id,
          type,
          title,
          message,
          entityType,
          entityId,
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('❌ Notify management error:', error);
    }
  }

  /**
   * Send targeted notification based on hostel/block/role
   */
  async notifyByTargeting({ type, title, message, entityType, entityId, targetHostels, targetBlocks, targetRole }) {
    try {
      const query = { isActive: true };

      if (targetRole && targetRole !== 'ALL') query.role = targetRole;
      if (targetHostels?.length > 0) query.hostel = { $in: targetHostels };
      if (targetBlocks?.length > 0) query.block = { $in: targetBlocks };

      const targetedUsers = await User.find(query).select('_id');

      const promises = targetedUsers.map(user =>
        this.notifyUser({
          userId: user._id,
          type,
          title,
          message,
          entityType,
          entityId,
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('❌ Notify targeting error:', error);
    }
  }

  /**
   * Get email template for notifications
   */
  getEmailTemplate(title, message, entityType, entityId) {
    const entityLink = entityId 
      ? `${process.env.FRONTEND_URL}/${entityType}s/${entityId}`
      : process.env.FRONTEND_URL;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🏠 SmartWard</h2>
          </div>
          <div class="content">
            <h3>${title}</h3>
            <p>${message}</p>
            ${entityId ? `<a href="${entityLink}" class="button">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>© 2026 SmartWard. All rights reserved.</p>
            <p>You are receiving this email because you signed up for SmartWard.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default new NotificationService();