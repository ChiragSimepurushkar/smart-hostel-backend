import LostFoundModel from '../models/lostFound.model.js';
import notificationService from '../services/notification.service.js';
import { getIO } from '../config/socket.js';

/**
 * Report lost/found item
 */
export const reportItem = async (req, res) => {
  try {
    const {
      itemName,
      description,
      category,
      type,
      location,
      hostel,
      block,
      dateLostFound,
      imageUrl,
      contactPhone,
      contactEmail,
    } = req.body;

    const userId = req.user.userId;

    const item = await LostFoundModel.create({
      itemName,
      description,
      category,
      type,
      location,
      hostel: hostel || req.user.hostelId,
      block: block || req.user.blockId,
      dateLostFound,
      reporter: userId,
      imageUrl,
      contactPhone,
      contactEmail,
    });

    const populatedItem = await LostFoundModel.findById(item._id)
      .populate('reporter', 'fullName email phone')
      .populate('hostel', 'name')
      .populate('block', 'name');

    // Emit socket event
    const io = getIO();
    io.to(`hostel:${item.hostel}`).emit('new_lost_found', populatedItem);

    res.status(201).json({
      success: true,
      message: `${type === 'LOST' ? 'Lost' : 'Found'} item reported successfully`,
      data: { item: populatedItem },
    });
  } catch (error) {
    console.error('Report item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reporting item',
      error: error.message,
    });
  }
};

/**
 * Get lost/found items with filters
 */
export const getItems = async (req, res) => {
  try {
    const {
      type,
      category,
      status,
      hostelId,
      blockId,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Build where clause
    const where = {};

    if (type) where.type = type;
    if (category) where.category = category;
    if (status) where.status = status;
    if (hostelId) where.hostel = hostelId;
    if (blockId) where.block = blockId;

    // Search
    if (search) {
      where.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      LostFoundModel.find(where)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .populate('reporter', 'fullName phone')
        .populate('claimedBy', 'fullName phone')
        .populate('hostel', 'name')
        .populate('block', 'name'),
      LostFoundModel.countDocuments(where),
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching items',
      error: error.message,
    });
  }
};

/**
 * Get item by ID
 */
export const getItemById = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await LostFoundModel.findById(id)
      .populate('reporter', 'fullName email phone')
      .populate('claimedBy', 'fullName email phone')
      .populate('hostel', 'name')
      .populate('block', 'name');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    res.json({
      success: true,
      data: { item },
    });
  } catch (error) {
    console.error('Get item by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching item',
      error: error.message,
    });
  }
};

/**
 * Claim item
 */
export const claimItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationInfo } = req.body;
    const userId = req.user.userId;

    const item = await LostFoundModel.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    if (item.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Item is not available for claim',
      });
    }

    // Update item
    item.claimedBy = userId;
    item.claimedAt = new Date();
    item.verificationInfo = verificationInfo;
    item.status = 'CLAIMED';
    await item.save();

    // Notify reporter
    await notificationService.notifyUser({
      userId: item.reporter,
      type: 'LOST_FOUND_MATCH',
      title: 'Item Claim Request',
      message: `Someone has claimed your ${item.type === 'LOST' ? 'lost' : 'found'} item: ${item.itemName}`,
      entityType: 'lost_found',
      entityId: item._id,
    });

    const populatedItem = await LostFoundModel.findById(item._id)
      .populate('reporter', 'fullName email phone')
      .populate('claimedBy', 'fullName email phone');

    res.json({
      success: true,
      message: 'Item claimed successfully. Reporter will be notified.',
      data: { item: populatedItem },
    });
  } catch (error) {
    console.error('Claim item error:', error);
    res.status(500).json({
      success: false,
      message: 'Error claiming item',
      error: error.message,
    });
  }
};

/**
 * Update item status
 */
export const updateItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const item = await LostFoundModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate('reporter', 'fullName')
      .populate('claimedBy', 'fullName');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    res.json({
      success: true,
      message: 'Item status updated successfully',
      data: { item },
    });
  } catch (error) {
    console.error('Update item status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating item status',
      error: error.message,
    });
  }
};