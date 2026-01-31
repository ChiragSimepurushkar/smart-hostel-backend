// controllers/issue.controller.js
import IssueModel from '../models/issue.model.js';
import IssueMediaModel from '../models/issueMedia.model.js';
import IssueCommentModel from '../models/issueComment.model.js';
import IssueReactionModel from '../models/issueReaction.model.js';
import IssueStatusHistoryModel from '../models/issueStatusHistory.model.js';
import StaffModel from '../models/staff.model.js';
import UserModel from '../models/user.model.js';
import HostelModel from '../models/hostel.model.js';
import BlockModel from '../models/block.model.js';
import aiService from '../services/ai.service.js';
import notificationService from '../services/notification.service.js';
// import { getIO } from '../config/socket.js';
import mongoose from 'mongoose';
import smartAssignmentService from '../services/smartAssignment.service.js';
import duplicateDetectionService from '../services/duplicateDetection.service.js';
import { getIO, emitToUser, emitToManagement, emitToHostel, emitToIssue } from '../socket/index.js';

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);
};

/**
 * Create new issue - FIXED VERSION
 */
export const createIssue = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      isPublic,
      hostel,
      block,
      roomNumber,
      forceDuplicate
    } = req.body;

    const userId = req.user.userId;
    const files = req.files || [];
    let similarIssues = [];

    // ===== 1. VALIDATE INPUT =====
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required',
      });
    }

    // ✅ FIX 2: Validate hostel is provided
    const finalHostelId = hostel || req.user.hostel;
    if (!finalHostelId) {
      return res.status(400).json({
        success: false,
        message: 'Hostel information is required',
      });
    }

    // ✅ FIX 3: Validate hostel ObjectId
    if (!isValidObjectId(finalHostelId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid hostel ID format',
      });
    }

    // ✅ FIX 4: Validate block ObjectId (if provided)
    const finalBlockId = block || req.user.block;
    if (finalBlockId && !isValidObjectId(finalBlockId)) {
      console.warn(`Invalid block ID: ${finalBlockId}, ignoring it`);
      // Don't return error, just ignore invalid block
    }

    // ===== 2. PROCESS UPLOADED FILES =====
    let mediaUrls = [];
    if (files && files.length > 0) {
      mediaUrls = files.map(file => ({
        mediaUrl: file.path || file.secure_url || file.url || file.location,
        mediaType: file.mimetype.startsWith('image/') ? 'image' :
          file.mimetype.startsWith('video/') ? 'video' : 'file',
        publicId: file.filename || file.public_id || file.key,
      }));

      console.log(`📸 Uploaded ${mediaUrls.length} file(s)`);
    }

    // ===== 3. AI-POWERED ANALYSIS =====
    let aiAnalysis;
    try {
      // ✅ FIX 5: Check if aiService method exists
      if (aiService.analyzeIssueWithRAG) {
        aiAnalysis = await aiService.analyzeIssueWithRAG({
          title,
          description,
          userCategory: category,
          userPriority: priority,
          images: mediaUrls.map(m => m.mediaUrl),
        });
        console.log(`🤖 AI Analysis: ${aiAnalysis.category} - ${aiAnalysis.priority} (${(aiAnalysis.confidence * 100).toFixed(1)}%)`);
      } else {
        throw new Error('AI service method not available');
      }
    } catch (aiError) {
      console.error('AI Service error:', aiError.message);
      aiAnalysis = {
        category: category || 'OTHER',
        priority: priority || 'MEDIUM',
        confidence: 0,
        reasoning: 'AI service unavailable',
      };
    }

    // ===== 4. DUPLICATE PREVENTION LOGIC =====
    let duplicateCheck = { isDuplicate: false, similarityScore: 0, similarIssues: [] };
    
    try {
      // ✅ FIX 6: Only pass valid ObjectIds to duplicate detection
      const duplicateCheckParams = {
        title,
        description,
        category: category || aiAnalysis.category,
        hostel: finalHostelId,
      };

      // Only add block if it's valid
      if (finalBlockId && isValidObjectId(finalBlockId)) {
        duplicateCheckParams.block = finalBlockId;
      }

      duplicateCheck = await duplicateDetectionService.checkForDuplicate(duplicateCheckParams);

      // Update similarIssues
      if (duplicateCheck.similarIssues && duplicateCheck.similarIssues.length > 0) {
        similarIssues = duplicateCheck.similarIssues;
      } else if (duplicateCheck.masterIssue) {
        similarIssues = [duplicateCheck.masterIssue];
      }

      console.log(`DEBUG: Duplicate Score: ${duplicateCheck.similarityScore}`);
    } catch (duplicateError) {
      console.error('Duplicate detection error:', duplicateError.message);
      // Continue without duplicate detection
    }

    // Demo Fail-Safe: If AI is 0 but title is exactly the same as an existing one
    if (duplicateCheck.similarityScore === 0) {
      const identicalIssue = await IssueModel.findOne({
        title: { $regex: new RegExp(`^${title.trim()}$`, 'i') },
        status: { $in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] },
        isDeleted: false
      });
      if (identicalIssue) {
        duplicateCheck.isDuplicate = true;
        duplicateCheck.similarityScore = 0.98;
        duplicateCheck.masterIssue = identicalIssue;
      }
    }

    // A. Handle High-Confidence Duplicate (Auto-Link)
    if (duplicateCheck.isDuplicate && duplicateCheck.similarityScore >= 0.90 && !forceDuplicate) {
      const masterIssue = duplicateCheck.masterIssue;

      const duplicateResult = await duplicateDetectionService.createDuplicateIssue(
        {
          title, 
          description, 
          category: category || aiAnalysis.category, 
          priority: priority || aiAnalysis.priority,
          hostel: finalHostelId, 
          block: finalBlockId && isValidObjectId(finalBlockId) ? finalBlockId : undefined,
          roomNumber, 
          reporter: userId
        },
        masterIssue,
        userId
      );

      const io = getIO();
      if (io) io.to('management-room').emit('duplicate_issue_detected', { masterIssueId: masterIssue._id });

      return res.status(200).json({
        success: true,
        isDuplicate: true,
        message: 'Duplicate detected and auto-linked to existing issue',
        data: { masterIssue, similarityScore: duplicateCheck.similarityScore }
      });
    }

    // B. Handle Medium Similarity (Requires User Confirmation)
    if (duplicateCheck.similarityScore >= 0.75 && duplicateCheck.similarityScore < 0.90 && !forceDuplicate) {
      return res.status(409).json({
        success: false,
        requiresConfirmation: true,
        message: 'Similar issue already exists. Create anyway?',
        data: { 
          similarIssue: duplicateCheck.masterIssue || duplicateCheck.similarIssues[0], 
          similarityScore: duplicateCheck.similarityScore 
        }
      });
    }

    // ===== 5. CREATE ISSUE =====
    const issueData = {
      title: title.trim(),
      description: description.trim(),
      category: category || aiAnalysis.category,
      priority: priority || aiAnalysis.priority,
      isPublic: isPublic !== undefined ? isPublic === 'true' || isPublic === true : true,

      hostel: finalHostelId,
      roomNumber: roomNumber || req.user.roomNumber,

      reporter: userId,

      aiCategory: aiAnalysis.category,
      aiPriority: aiAnalysis.priority,
      aiConfidence: aiAnalysis.confidence,

      similarIssues: similarIssues.map(issue =>
        mongoose.Types.ObjectId.isValid(issue.issue_id) ? issue.issue_id : (issue._id || issue)
      ),

      status: 'REPORTED',
      reportedAt: new Date(),
    };

    // ✅ FIX 7: Only add block if it's a valid ObjectId
    if (finalBlockId && isValidObjectId(finalBlockId)) {
      issueData.block = finalBlockId;
    }

    const issue = await IssueModel.create(issueData);
    console.log(`✅ Issue created: ${issue._id}`);

    // ===== 6. CREATE MEDIA RECORDS =====
    let media = [];
    if (mediaUrls.length > 0) {
      try {
        const mediaRecords = mediaUrls.map(mediaItem => ({
          issue: issue._id,
          mediaUrl: mediaItem.mediaUrl,
          mediaType: mediaItem.mediaType,
          publicId: mediaItem.publicId,
        }));

        media = await IssueMediaModel.insertMany(mediaRecords);
        console.log(`📎 ${media.length} media file(s) linked to issue`);
      } catch (mediaError) {
        console.error('Media creation error:', mediaError.message);
      }
    }

    // ===== 7. CREATE STATUS HISTORY =====
    try {
      await IssueStatusHistoryModel.create({
        issue: issue._id,
        status: 'REPORTED',
        updatedBy: userId,
        remarks: 'Issue reported',
        createdAt: new Date(),
      });
    } catch (historyError) {
      console.error('Status history error:', historyError.message);
    }

    // ===== 8. SMART ASSIGNMENT RECOMMENDATIONS =====
    let assignmentRecommendations = null;
    let autoAssignResult = null;

    try {
      assignmentRecommendations = await smartAssignmentService.getStaffRecommendations(
        issue,
        aiAnalysis
      );

      console.log(`🤖 Smart Assignment: ${assignmentRecommendations.recommendations.length} recommendations`);

      if (assignmentRecommendations.autoAssignRecommended) {
        autoAssignResult = await smartAssignmentService.autoAssignIssue(
          issue._id,
          assignmentRecommendations.recommendations
        );

        if (autoAssignResult.success) {
          console.log(`✅ Auto-assigned to ${autoAssignResult.assignedStaff.fullName}`);

          issue.assignedTo = autoAssignResult.assignedStaff._id;
          issue.assignedAt = new Date();
          issue.status = 'ASSIGNED';
          await issue.save();
        }
      }
    } catch (assignError) {
      console.error('Assignment recommendation error:', assignError.message);
    }

    // ===== 9. POPULATE ISSUE FOR RESPONSE =====
    const populatedIssue = await IssueModel.findById(issue._id)
      .populate('reporter', 'fullName email phone profileImage')
      .populate('hostel', 'name location')
      .populate('block', 'name floorCount')
      .populate('assignedTo', 'fullName role phone email')
      .lean();

    // ===== 10. SEND NOTIFICATIONS =====
    try {
      await notificationService.notifyManagement({
        type: 'ISSUE_CREATED',
        title: 'New Issue Reported',
        message: `${populatedIssue.priority} priority ${populatedIssue.category} issue: ${populatedIssue.title}`,
        entityType: 'issue',
        entityId: issue._id,
        hostelId: populatedIssue.hostel?._id,
      });
      console.log('📧 Management notified');
    } catch (notifyError) {
      console.error('Notification error:', notifyError.message);
    }

    // ===== 11. EMIT SOCKET EVENT =====
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`hostel:${populatedIssue.hostel?._id}`).emit('new_issue', {
          issue: populatedIssue,
          aiAnalysis,
          autoAssigned: autoAssignResult?.success || false
        });

        io.to('management-room').emit('new_issue_management', {
          issue: populatedIssue,
          priority: populatedIssue.priority,
          reporter: populatedIssue.reporter
        });

        console.log('🔔 Real-time updates sent');
      }
    } catch (socketError) {
      console.log('⚠️ Socket not ready, skipping real-time update');
    }

    // ===== 12. RETURN RESPONSE =====
    res.status(201).json({
      success: true,
      message: 'Issue created successfully',
      data: {
        issue: populatedIssue,
        media,
        aiAnalysis: {
          suggestedCategory: aiAnalysis.category,
          suggestedPriority: aiAnalysis.priority,
          confidence: aiAnalysis.confidence,
          reasoning: aiAnalysis.reasoning,
          suggestedSolution: aiAnalysis.suggestedSolution,
          similarPastIssues: aiAnalysis.similarPastIssues,
          estimatedResolutionTime: aiAnalysis.estimatedResolutionTime,
          recommendedStaff: aiAnalysis.recommendedStaff,
          usedCategory: populatedIssue.category,
          usedPriority: populatedIssue.priority,
        },
        similarIssues: similarIssues.length > 0 ? similarIssues : null,
        assignmentRecommendations: assignmentRecommendations?.recommendations || [],
        autoAssigned: autoAssignResult?.success || false,
        assignedStaff: autoAssignResult?.assignedStaff || null,
        warnings: [
          ...(similarIssues.length > 0 ? [
            `Found ${similarIssues.length} similar issue(s). Please check if this is a duplicate.`
          ] : []),
          ...(autoAssignResult?.success ? [
            `Automatically assigned to ${autoAssignResult.assignedStaff.fullName} (${autoAssignResult.confidence}% match)`
          ] : []),
        ],
      },
    });

  } catch (error) {
    console.error('❌ Create issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating issue',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};


/**
 * Get issues with filters
 */
export const getIssues = async (req, res) => {
  try {
    const {
      category,
      priority,
      status,
      hostelId,
      blockId,
      isPublic,
      reporterId,
      assignedToId,
      search,
      page = 1,
      limit = 20,
      sortBy = 'reportedAt',
      sortOrder = 'desc',
    } = req.query;

    const userId = req.user.userId;
    const userRole = req.user.role;

    // ===== BUILD FILTER =====
    const where = { isDeleted: false };

    if (userRole === 'STUDENT') {
      where.$or = [
        { reporter: userId },
        { isPublic: true },
      ];
    }

    if (category) where.category = category;
    if (priority) {
      where.priority = Array.isArray(priority) ? { $in: priority } : priority;
    }
    if (status) {
      where.status = Array.isArray(status) ? { $in: status } : status;
    }
    if (hostelId) where.hostel = hostelId;
    if (blockId) where.block = blockId;
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';
    if (reporterId) where.reporter = reporterId;
    if (assignedToId) where.assignedTo = assignedToId;

    if (search) {
      where.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // ===== PAGINATION =====
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // ===== FETCH ISSUES =====
    const [issues, total] = await Promise.all([
      IssueModel.find(where)
        .populate('reporter', 'fullName email profileImage')
        .populate('assignedTo', 'fullName role phone')
        .populate('hostel', 'name')
        .populate('block', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),

      IssueModel.countDocuments(where),
    ]);

    // ===== GET MEDIA & COMMENT COUNTS =====
    const issueIds = issues.map(issue => issue._id);

    const [mediaData, commentCounts] = await Promise.all([
      IssueMediaModel.find({ issue: { $in: issueIds } }).lean(),
      IssueCommentModel.aggregate([
        { $match: { issue: { $in: issueIds } } },
        { $group: { _id: '$issue', count: { $sum: 1 } } }
      ])
    ]);

    const mediaByIssue = mediaData.reduce((acc, media) => {
      const issueId = media.issue.toString();
      if (!acc[issueId]) acc[issueId] = [];
      acc[issueId].push(media);
      return acc;
    }, {});

    const commentCountMap = commentCounts.reduce((acc, item) => {
      acc[item._id.toString()] = item.count;
      return acc;
    }, {});

    const issuesWithData = issues.map(issue => ({
      ...issue,
      media: mediaByIssue[issue._id.toString()] || [],
      mediaCount: (mediaByIssue[issue._id.toString()] || []).length,
      commentCount: commentCountMap[issue._id.toString()] || 0,
    }));

    res.json({
      success: true,
      data: {
        issues: issuesWithData,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNextPage: skip + issues.length < total,
          hasPrevPage: parseInt(page) > 1,
        },
        filters: { category, priority, status, hostelId, blockId, search },
      },
    });

  } catch (error) {
    console.error('Get issues error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching issues',
      error: error.message,
    });
  }
};


/**
 * Get single issue by ID
 */
export const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const issue = await IssueModel.findById(id)
      .populate('reporter', 'fullName email phone profileImage department year')
      .populate('assignedTo', 'fullName role phone email specialization')
      .populate('hostel', 'name location totalBlocks capacity')
      .populate('block', 'name floorCount')
      .lean();

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    // ===== CHECK PERMISSIONS =====
    if (userRole === 'STUDENT') {
      const reporterId = issue.reporter?._id?.toString();
      if (!issue.isPublic && reporterId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this issue',
        });
      }
    }

    // ===== GET RELATED DATA =====
    const [media, comments, reactions, statusHistory, similarIssuesDetails] = await Promise.all([
      IssueMediaModel.find({ issue: id }).lean(),

      IssueCommentModel.find({ issue: id })
        .populate('user', 'fullName role profileImage')
        .sort({ createdAt: 1 })
        .lean(),

      IssueReactionModel.find({ issue: id })
        .populate('user', 'fullName profileImage')
        .lean(),

      IssueStatusHistoryModel.find({ issue: id })
        .populate('updatedBy', 'fullName role')
        .sort({ createdAt: 1 })
        .lean(),

      issue.similarIssues && issue.similarIssues.length > 0
        ? IssueModel.find({ _id: { $in: issue.similarIssues } })
          .select('title status priority category createdAt')
          .lean()
        : []
    ]);

    res.json({
      success: true,
      data: {
        issue,
        media,
        comments,
        reactions,
        statusHistory,
        similarIssues: similarIssuesDetails,
      },
    });

  } catch (error) {
    console.error('Get issue by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching issue',
      error: error.message,
    });
  }
};


/**
 * Update issue
 */
export const updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.userId;

    const allowedUpdates = ['title', 'description', 'category', 'priority', 'isPublic'];
    const requestedUpdates = Object.keys(updates);
    const isValidUpdate = requestedUpdates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid updates',
        allowedFields: allowedUpdates,
      });
    }

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    if (issue.reporter.toString() !== userId && req.user.role !== 'MANAGEMENT') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this issue',
      });
    }

    const updatedIssue = await IssueModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('reporter', 'fullName email')
      .populate('hostel', 'name')
      .populate('block', 'name');

    await IssueStatusHistoryModel.create({
      issue: id,
      status: updatedIssue.status,
      updatedBy: userId,
      remarks: `Issue updated: ${Object.keys(updates).join(', ')}`,
    });

    res.json({
      success: true,
      message: 'Issue updated successfully',
      data: { issue: updatedIssue },
    });

  } catch (error) {
    console.error('Update issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating issue',
      error: error.message,
    });
  }
};


/**
 * Assign issue to staff
 */
export const assignIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId, priority, remarks } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format',
      });
    }

    const staff = await StaffModel.findById(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found',
      });
    }

    if (!staff.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Staff member is not active',
      });
    }

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    issue.assignedTo = staffId;
    issue.assignedAt = new Date();
    issue.status = 'ASSIGNED';

    if (priority) {
      issue.priority = priority;
    }

    await issue.save();

    await IssueStatusHistoryModel.create({
      issue: issue._id,
      status: 'ASSIGNED',
      updatedBy: userId,
      remarks: remarks || `Assigned to ${staff.fullName}`,
    });

    const updatedIssue = await IssueModel.findById(id)
      .populate('reporter', 'fullName email')
      .populate('assignedTo', 'fullName role phone email')
      .populate('hostel', 'name')
      .populate('block', 'name');

    await notificationService.notifyUser({
      userId: issue.reporter,
      type: 'ISSUE_STATUS_UPDATED',
      title: 'Issue Assigned',
      message: `Your issue has been assigned to ${staff.fullName}`,
      entityType: 'issue',
      entityId: issue._id,
    });

    try {
      const io = getIO();
      if (io) {
        io.to(`user:${issue.reporter}`).emit('issue_updated', updatedIssue);
      }
    } catch (socketError) {
      console.log('Socket error:', socketError.message);
    }

    res.json({
      success: true,
      message: 'Issue assigned successfully',
      data: { issue: updatedIssue },
    });

  } catch (error) {
    console.error('Assign issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning issue',
      error: error.message,
    });
  }
};


/**
 * Update issue status
 */
export const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const userId = req.user.userId;

    const currentIssue = await IssueModel.findById(id);

    if (!currentIssue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    const validTransitions = {
      REPORTED: ['ASSIGNED', 'REJECTED', 'CLOSED'],
      ASSIGNED: ['IN_PROGRESS', 'REPORTED', 'CLOSED'],
      IN_PROGRESS: ['RESOLVED', 'ASSIGNED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS'],
      CLOSED: [],
      REJECTED: [],
    };

    if (!validTransitions[currentIssue.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${currentIssue.status} to ${status}`,
      });
    }

    const updateData = { status };

    if (status === 'RESOLVED') {
      updateData.resolvedAt = new Date();
    } else if (status === 'CLOSED') {
      updateData.closedAt = new Date();
    }

    const issue = await IssueModel.findByIdAndUpdate(id, updateData, { new: true })
      .populate('reporter', 'fullName email')
      .populate('assignedTo', 'fullName role');

    if (issue.assignedTo) {
      if (status === 'RESOLVED' || status === 'CLOSED') {
        await smartAssignmentService.updateStaffWorkload(issue.assignedTo._id, 'resolve');

        // Calculate performance metrics
        await smartAssignmentService.calculateStaffPerformance(issue.assignedTo._id);

        try {
          // Calculate resolution time for the RAG database
          const resolutionTimeHours = (new Date(issue.resolvedAt) - new Date(issue.assignedAt)) / (1000 * 60 * 60);

          await aiService.addToKnowledgeBase({
            issueId: issue._id.toString(),
            title: issue.title,
            description: issue.description,
            category: issue.category,
            priority: issue.priority,
            solution: remarks || 'Issue resolved successfully', // Use management remarks as the 'answer'
            staffName: issue.assignedTo?.fullName || 'Unknown',
            resolutionTimeHours: resolutionTimeHours > 0 ? resolutionTimeHours : 0,
            hostelName: issue.hostel?.name || 'Unknown'
          });
          console.log(`🧠 AI Knowledge Base updated for issue ${issue._id}`);
        } catch (ragError) {
          console.warn('⚠️ Knowledge base update failed:', ragError.message);
        }
      }
    }

    await IssueStatusHistoryModel.create({
      issue: id,
      status,
      updatedBy: userId,
      remarks: remarks || `Status updated to ${status}`,
    });

    await notificationService.notifyUser({
      userId: issue.reporter._id,
      type: 'ISSUE_STATUS_UPDATED',
      title: `Issue ${status}`,
      message: `Your issue "${issue.title}" is now ${status.toLowerCase()}`,
      entityType: 'issue',
      entityId: issue._id,
    });

    // ===== EMIT STATUS UPDATES =====
    try {
      const io = req.app.get('io');

      // Notify the student who reported it
      io.to(`user:${issue.reporter._id}`).emit('issue_updated', {
        issueId: issue._id,
        status: status, // the new status
        message: `Your issue status changed to ${status}`
      });

      // Notify anyone currently viewing this specific issue's detail page
      io.to(`issue:${issue._id}`).emit('status_changed', {
        issueId: issue._id,
        status: status,
        updatedBy: req.user.fullName
      });
    } catch (err) {
      console.warn('Socket error during status update:', err.message);
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: { issue },
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: error.message,
    });
  }
};


/**
 * Add comment to issue
 */
export const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, parentComment } = req.body;
    const userId = req.user.userId;

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    if (
      !issue.isPublic &&
      issue.reporter.toString() !== userId &&
      req.user.role !== 'MANAGEMENT' &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const newComment = await IssueCommentModel.create({
      issue: id,
      user: userId,
      comment,
      parentComment,
    });

    const populatedComment = await IssueCommentModel.findById(newComment._id)
      .populate('user', 'fullName role profileImage');

    if (issue.reporter.toString() !== userId) {
      await notificationService.notifyUser({
        userId: issue.reporter,
        type: 'ISSUE_COMMENTED',
        title: 'New Comment',
        message: `${populatedComment.user.fullName} commented on your issue`,
        entityType: 'issue',
        entityId: id,
      });
    }

    // ===== EMIT NEW COMMENT =====
    try {
      const io = req.app.get('io');

      // Broadcast the new comment to the specific issue room
      io.to(`issue:${id}`).emit('new_comment', {
        comment: populatedComment,
        user: {
          fullName: req.user.fullName
        }
      });
    } catch (err) {
      console.warn('Socket error during comment emission:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment: populatedComment },
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message,
    });
  }
};


/**
 * Toggle reaction on issue
 */
export const toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const userId = req.user.userId;

    const validTypes = ['thumbs_up', 'thumbs_down', 'fire'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reaction type',
        validTypes,
      });
    }

    const existing = await IssueReactionModel.findOne({
      issue: id,
      user: userId,
      type,
    });

    if (existing) {
      await IssueReactionModel.findByIdAndDelete(existing._id);

      return res.json({
        success: true,
        message: 'Reaction removed',
        data: { action: 'removed', type },
      });
    } else {
      const reaction = await IssueReactionModel.create({
        issue: id,
        user: userId,
        type,
      });

      const populatedReaction = await IssueReactionModel.findById(reaction._id)
        .populate('user', 'fullName profileImage');

      try {
        const io = getIO();
        if (io) {
          io.to(`issue:${id}`).emit('reaction_updated', {
            issueId: id,
            userId,
            type,
            action: 'added'
          });
        }
      } catch (socketError) {
        console.log('Socket error:', socketError.message);
      }

      return res.json({
        success: true,
        message: 'Reaction added',
        data: { action: 'added', reaction: populatedReaction },
      });
    }

  } catch (error) {
    console.error('Toggle reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling reaction',
      error: error.message,
    });
  }
};


/**
 * Merge duplicate issue
 */
export const mergeIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { targetId } = req.body;
    const userId = req.user.userId;

    const [duplicate, target] = await Promise.all([
      IssueModel.findById(id),
      IssueModel.findById(targetId),
    ]);

    if (!duplicate || !target) {
      return res.status(404).json({
        success: false,
        message: 'One or both issues not found',
      });
    }

    await IssueModel.findByIdAndUpdate(id, {
      duplicateOf: targetId,
      status: 'CLOSED',
      closedAt: new Date(),
    });

    await IssueStatusHistoryModel.create({
      issue: id,
      status: 'CLOSED',
      updatedBy: userId,
      remarks: `Merged with issue #${targetId}`,
    });

    await IssueCommentModel.create({
      issue: targetId,
      user: userId,
      comment: `Issue #${id} was merged with this issue as a duplicate.`,
    });

    await notificationService.notifyUser({
      userId: duplicate.reporter,
      type: 'ISSUE_STATUS_UPDATED',
      title: 'Issue Merged',
      message: `Your issue was identified as a duplicate and merged with #${targetId}`,
      entityType: 'issue',
      entityId: targetId,
    });

    res.json({
      success: true,
      message: 'Issues merged successfully',
      data: { targetIssueId: targetId },
    });

  } catch (error) {
    console.error('Merge issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Error merging issues',
      error: error.message,
    });
  }
};


/**
 * Bulk update issues
 */
export const bulkUpdate = async (req, res) => {
  try {
    const { issueIds, updates } = req.body;
    const userId = req.user.userId;

    const allowedUpdates = ['status', 'priority', 'assignedTo'];
    const updateData = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        updateData[key] = value;
      }
    }

    await IssueModel.updateMany(
      { _id: { $in: issueIds } },
      updateData
    );

    if (updates.status) {
      const historyEntries = issueIds.map(issueId => ({
        issue: issueId,
        status: updates.status,
        updatedBy: userId,
        remarks: 'Bulk status update',
      }));

      await IssueStatusHistoryModel.insertMany(historyEntries);
    }

    res.json({
      success: true,
      message: `${issueIds.length} issues updated successfully`,
    });

  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing bulk update',
      error: error.message,
    });
  }
};


/**
 * Delete issue (soft delete)
 */
export const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    if (req.user.role !== 'MANAGEMENT' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only management can delete issues',
      });
    }

    issue.isDeleted = true;
    issue.deletedAt = new Date();
    await issue.save();

    await IssueStatusHistoryModel.create({
      issue: id,
      status: issue.status,
      updatedBy: userId,
      remarks: 'Issue deleted',
    });

    res.json({
      success: true,
      message: 'Issue deleted successfully',
    });

  } catch (error) {
    console.error('Delete issue error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting issue',
      error: error.message,
    });
  }
};



// backend/controllers/issue.controller.js - ADD THIS

/**
 * Get staff recommendations for an issue
 */
export const getStaffRecommendations = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await IssueModel.findById(id)
      .populate('reporter', 'fullName')
      .lean();

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    // Get AI analysis data from the issue
    const aiAnalysis = {
      aiCategory: issue.aiCategory || issue.category,
      aiPriority: issue.aiPriority || issue.priority,
      confidence: issue.aiConfidence || 0,
    };

    // Get recommendations
    const recommendations = await smartAssignmentService.getStaffRecommendations(
      issue,
      aiAnalysis
    );

    res.json({
      success: true,
      data: {
        issue: {
          _id: issue._id,
          title: issue.title,
          category: issue.category,
          priority: issue.priority,
          status: issue.status,
        },
        recommendations: recommendations.recommendations || [],
        autoAssignRecommended: recommendations.autoAssignRecommended || false,
        aiConfidence: recommendations.aiConfidence || 0,
      },
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting recommendations',
      error: error.message,
    });
  }
};

/**
 * Manually assign with AI recommendation
 */
export const assignWithRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const { useTopRecommendation } = req.body;
    const userId = req.user.userId;

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    if (useTopRecommendation) {
      // Get AI analysis
      const aiAnalysis = {
        aiCategory: issue.aiCategory || issue.category,
        aiPriority: issue.aiPriority || issue.priority,
        confidence: issue.aiConfidence || 0,
      };

      // Get recommendations
      const recommendations = await smartAssignmentService.getStaffRecommendations(
        issue,
        aiAnalysis
      );

      if (!recommendations.success || recommendations.recommendations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No staff recommendations available',
        });
      }

      // Auto-assign to top recommendation
      const result = await smartAssignmentService.autoAssignIssue(
        id,
        recommendations.recommendations
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Create status history
      await IssueStatusHistoryModel.create({
        issue: id,
        status: 'ASSIGNED',
        updatedBy: userId,
        remarks: `AI-recommended assignment to ${result.assignedStaff.fullName} (${result.confidence}% match)`,
      });

      // Send notifications
      await notificationService.notifyUser({
        userId: issue.reporter,
        type: 'ISSUE_STATUS_UPDATED',
        title: 'Issue Assigned',
        message: `Your issue has been assigned to ${result.assignedStaff.fullName}`,
        entityType: 'issue',
        entityId: id,
      });

      return res.json({
        success: true,
        message: 'Issue assigned using AI recommendation',
        data: result,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Manual assignment not implemented in this endpoint. Use /api/issues/:id/assign instead.',
      });
    }
  } catch (error) {
    console.error('Assign with recommendation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning issue',
      error: error.message,
    });
  }
};



/**
 * Link issue as duplicate manually
 */
export const linkAsDuplicate = async (req, res) => {
  try {
    const { id } = req.params; // Issue to mark as duplicate
    const { masterIssueId } = req.body;
    const userId = req.user.userId;

    const issue = await IssueModel.findById(id);
    const masterIssue = await IssueModel.findById(masterIssueId);

    if (!issue || !masterIssue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found'
      });
    }

    // Link duplicate
    const result = await duplicateDetectionService.linkDuplicate(
      id,
      masterIssueId,
      issue.reporter
    );

    // Create status history
    await IssueStatusHistoryModel.create({
      issue: id,
      status: 'CLOSED',
      updatedBy: userId,
      remarks: `Marked as duplicate of Issue #${masterIssueId.toString().slice(-6)}`
    });

    // Notify reporter
    await notificationService.notifyUser({
      userId: issue.reporter,
      type: 'ISSUE_STATUS_UPDATED',
      title: 'Issue Marked as Duplicate',
      message: `Your issue has been linked to an existing issue that's being addressed`,
      entityType: 'issue',
      entityId: masterIssueId
    });

    // Socket.io update
    io.to(`user:${issue.reporter}`).emit('issue_duplicate_linked', {
      issueId: id,
      masterIssueId
    });

    res.json({
      success: true,
      message: 'Issue marked as duplicate',
      data: result
    });
  } catch (error) {
    console.error('Link duplicate error:', error);
    res.status(500).json({
      success: false,
      message: 'Error linking duplicate',
      error: error.message
    });
  }
};

/**
 * Get all duplicates of an issue
 */
export const getDuplicates = async (req, res) => {
  try {
    const { id } = req.params;

    const duplicates = await duplicateDetectionService.getDuplicates(id);

    res.json({
      success: true,
      data: {
        count: duplicates.length,
        duplicates
      }
    });
  } catch (error) {
    console.error('Get duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching duplicates',
      error: error.message
    });
  }
};

/**
 * Get all comments for an issue
 */
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    // Permission check
    if (
      userRole === 'STUDENT' &&
      !issue.isPublic &&
      issue.reporter.toString() !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const comments = await IssueCommentModel.find({ issue: id })
      .populate('user', 'fullName role profileImage')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        count: comments.length,
        comments,
      },
    });

  } catch (error) {
    console.error('Get comments error:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message,
    });
  }
};
/**
 * Get all reactions for an issue
 */
export const getReactions = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await IssueModel.findById(id);

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: 'Issue not found',
      });
    }

    const reactions = await IssueReactionModel.find({ issue: id })
      .populate('user', 'fullName profileImage')
      .lean();

    // Group reactions by type
    const summary = reactions.reduce((acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        total: reactions.length,
        summary,   // { thumbs_up: 3, fire: 1 }
        reactions, // full list
      },
    });

  } catch (error) {
    console.error('Get reactions error:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching reactions',
      error: error.message,
    });
  }
};
