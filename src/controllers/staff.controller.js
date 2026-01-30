import StaffModel from '../models/staff.model.js';

/**
 * Create staff member
 */
export const createStaff = async (req, res) => {
  try {
    const {
      fullName,
      role,
      phone,
      email,
      specialization,
      assignedHostels,
      assignedBlocks,
      workingHours,
    } = req.body;

    const staff = await StaffModel.create({
      fullName,
      role,
      phone,
      email,
      specialization: specialization || [],
      assignedHostels: assignedHostels || [],
      assignedBlocks: assignedBlocks || [],
      workingHours,
    });

    const populatedStaff = await StaffModel.findById(staff._id)
      .populate('assignedHostels', 'name')
      .populate('assignedBlocks', 'name');

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: { staff: populatedStaff },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating staff member',
      error: error.message,
    });
  }
};

/**
 * Get all staff members
 */
export const getStaff = async (req, res) => {
  try {
    const {
      role,
      hostelId,
      isActive,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    // Build where clause
    const where = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (hostelId) where.assignedHostels = hostelId;

    // Search
    if (search) {
      where.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    const [staff, total] = await Promise.all([
      StaffModel.find(where)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .populate('assignedHostels', 'name')
        .populate('assignedBlocks', 'name'),
      StaffModel.countDocuments(where),
    ]);

    res.json({
      success: true,
      data: {
        staff,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message,
    });
  }
};

/**
 * Get staff by ID
 */
export const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await StaffModel.findById(id)
      .populate('assignedHostels', 'name')
      .populate('assignedBlocks', 'name');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    res.json({
      success: true,
      data: { staff },
    });
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff member',
      error: error.message,
    });
  }
};

/**
 * Update staff member
 */
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const staff = await StaffModel.findByIdAndUpdate(id, updates, {
      new: true,
    })
      .populate('assignedHostels', 'name')
      .populate('assignedBlocks', 'name');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: { staff },
    });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating staff member',
      error: error.message,
    });
  }
};

/**
 * Delete staff member (deactivate)
 */
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await StaffModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    res.json({
      success: true,
      message: 'Staff member deactivated successfully',
    });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating staff member',
      error: error.message,
    });
  }
};

/**
 * Get staff workload
 */
export const getStaffWorkload = async (req, res) => {
  try {
    const { id } = req.params;

    const IssueModel = require('../models/issue.model.js').default;

    const [activeIssues, totalHandled, avgTime] = await Promise.all([
      IssueModel.countDocuments({
        assignedTo: id,
        status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
      }),
      IssueModel.countDocuments({ assignedTo: id }),
      IssueModel.aggregate([
        {
          $match: {
            assignedTo: id,
            status: 'RESOLVED',
            resolvedAt: { $exists: true },
          },
        },
        {
          $project: {
            resolutionTime: {
              $divide: [
                { $subtract: ['$resolvedAt', '$reportedAt'] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$resolutionTime' },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        activeIssues,
        totalHandled,
        avgResolutionTime: avgTime[0]?.avgTime?.toFixed(1) || 'N/A',
      },
    });
  } catch (error) {
    console.error('Get staff workload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff workload',
      error: error.message,
    });
  }
};