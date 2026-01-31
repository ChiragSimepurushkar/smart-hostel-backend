// backend/src/controllers/hostel.controller.js
import HostelModel from '../models/hostel.model.js';
import BlockModel from '../models/block.model.js';

/**
 * Get all hostels (for dropdown)
 */
export const getAllHostels = async (req, res) => {
  try {
    const hostels = await HostelModel.find({
      $or: [
        { isActive: true },
        { isActive: { $exists: false } }
      ]
    })
      .select('name _id location totalBlocks')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: hostels,
      message: 'Hostels fetched successfully'
    });
  } catch (error) {
    console.error('Get hostels error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hostels',
      error: error.message
    });
  }
};

/**
 * Get blocks for a specific hostel (for dropdown)
 */
export const getHostelBlocks = async (req, res) => {
  try {
    const { hostelId } = req.params;

    const blocks = await BlockModel.find({
      hostel: hostelId,
      isActive: true
    })
      .select('name _id floorCount')
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: blocks,
      message: 'Blocks fetched successfully'
    });
  } catch (error) {
    console.error('Get blocks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blocks',
      error: error.message
    });
  }
};

/**
 * Get single hostel details
 */
export const getHostelById = async (req, res) => {
  try {
    const { id } = req.params;

    const hostel = await HostelModel.findById(id)
      .populate('blocks')
      .lean();

    if (!hostel) {
      return res.status(404).json({
        success: false,
        message: 'Hostel not found'
      });
    }

    res.json({
      success: true,
      data: hostel
    });
  } catch (error) {
    console.error('Get hostel error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hostel',
      error: error.message
    });
  }
};