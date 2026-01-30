import AnnouncementModel from '../models/announcement.model.js';
import notificationService from '../services/notification.service.js';
import { getIO } from '../config/socket.js';

/**
 * Create announcement
 */
export const createAnnouncement = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      targetHostels,
      targetBlocks,
      targetRole,
      isPinned,
      attachments,
      publishAt,
    } = req.body;

    const userId = req.user.userId;

    const announcement = await AnnouncementModel.create({
      title,
      content,
      category: category || 'GENERAL',
      targetHostels: targetHostels || [],
      targetBlocks: targetBlocks || [],
      targetRole: targetRole || 'ALL',
      createdBy: userId,
      isPinned: isPinned || false,
      attachments: attachments || [],
      publishAt: publishAt || new Date(),
    });

    const populatedAnnouncement = await AnnouncementModel.findById(announcement._id)
      .populate('createdBy', 'fullName role')
      .populate('targetHostels', 'name')
      .populate('targetBlocks', 'name');

    // Send notifications to targeted users
    await notificationService.notifyByTargeting({
      type: 'ANNOUNCEMENT_POSTED',
      title: 'New Announcement',
      message: title,
      entityType: 'announcement',
      entityId: announcement._id,
      targetHostels,
      targetBlocks,
      targetRole,
    });

    // Emit socket event
    const io = getIO();
    if (targetHostels && targetHostels.length > 0) {
      targetHostels.forEach(hostelId => {
        io.to(`hostel:${hostelId}`).emit('new_announcement', populatedAnnouncement);
      });
    } else {
      io.emit('new_announcement', populatedAnnouncement);
    }

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: { announcement: populatedAnnouncement },
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message,
    });
  }
};

/**
 * Get announcements with filters
 */
export const getAnnouncements = async (req, res) => {
  try {
    const {
      category,
      hostelId,
      blockId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const userId = req.user.userId;
    const userRole = req.user.role;
    const userHostelId = req.user.hostelId;

    // Build where clause
    const where = {
      isActive: true,
      publishAt: { $lte: new Date() },
    };

    // Filter by category
    if (category) where.category = category;

    // Filter by targeting
    if (userRole === 'STUDENT') {
      where.$or = [
        { targetRole: 'ALL' },
        { targetRole: 'STUDENT' },
      ];

      // Show only announcements for user's hostel or global announcements
      where.$and = [
        {
          $or: [
            { targetHostels: { $size: 0 } }, // Global
            { targetHostels: userHostelId },
          ],
        },
      ];
    }

    if (hostelId) {
      where.$or = [
        { targetHostels: { $size: 0 } },
        { targetHostels: hostelId },
      ];
    }

    if (blockId) {
      where.$or = [
        { targetBlocks: { $size: 0 } },
        { targetBlocks: blockId },
      ];
    }

    // Search
    if (search) {
      where.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      AnnouncementModel.find(where)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ isPinned: -1, publishAt: -1 })
        .populate('createdBy', 'fullName role')
        .populate('targetHostels', 'name')
        .populate('targetBlocks', 'name'),
      AnnouncementModel.countDocuments(where),
    ]);

    res.json({
      success: true,
      data: {
        announcements,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message,
    });
  }
};

/**
 * Get announcement by ID
 */
export const getAnnouncementById = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await AnnouncementModel.findById(id)
      .populate('createdBy', 'fullName role email')
      .populate('targetHostels', 'name')
      .populate('targetBlocks', 'name');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Increment view count
    announcement.viewCount += 1;
    await announcement.save();

    res.json({
      success: true,
      data: { announcement },
    });
  } catch (error) {
    console.error('Get announcement by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: error.message,
    });
  }
};

/**
 * Update announcement
 */
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const announcement = await AnnouncementModel.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    )
      .populate('createdBy', 'fullName role')
      .populate('targetHostels', 'name')
      .populate('targetBlocks', 'name');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: { announcement },
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message,
    });
  }
};

/**
 * Delete announcement
 */
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await AnnouncementModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message,
    });
  }
};