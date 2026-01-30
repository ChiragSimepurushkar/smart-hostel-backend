/**
 * Get management dashboard stats
 */
export const getManagementDashboard = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;

    // Date range
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Build where clause
    const where = {
      isDeleted: false,
      reportedAt: {
        $gte: start,
        $lte: end,
      },
    };

    if (hostelId) {
      where.hostel = hostelId;
    }

    // Parallel queries
    const [
      totalIssues,
      pendingIssues,
      resolvedToday,
      categoryBreakdown,
      priorityBreakdown,
      recentIssues,
      urgentIssues,
    ] = await Promise.all([
      // Total issues
      IssueModel.countDocuments(where),

      // Pending issues
      IssueModel.countDocuments({
        ...where,
        status: { $in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] },
      }),

      // Resolved today
      IssueModel.countDocuments({
        ...where,
        status: 'RESOLVED',
        resolvedAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      }),

      // Category breakdown
      IssueModel.aggregate([
        { $match: where },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),

      // Priority breakdown
      IssueModel.aggregate([
        { $match: where },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),

      // Recent issues
      IssueModel.find(where)
        .sort({ reportedAt: -1 })
        .limit(10)
        .populate('reporter', 'fullName')
        .populate('assignedTo', 'fullName'),

      // Urgent issues
      IssueModel.find({
        ...where,
        priority: { $in: ['HIGH', 'EMERGENCY'] },
        status: { $nin: ['RESOLVED', 'CLOSED'] },
      })
        .sort({ priority: -1, reportedAt: 1 })
        .limit(5)
        .populate('reporter', 'fullName'),
    ]);

    // Calculate average resolution time
    const resolvedIssues = await IssueModel.find({
      ...where,
      status: 'RESOLVED',
      resolvedAt: { $exists: true },
    }).select('reportedAt resolvedAt');

    let avgResolutionTime = 'N/A';
    if (resolvedIssues.length > 0) {
      const totalTime = resolvedIssues.reduce((sum, issue) => {
        const diff = issue.resolvedAt - issue.reportedAt;
        return sum + diff;
      }, 0);
      const avgMs = totalTime / resolvedIssues.length;
      const avgHours = (avgMs / (1000 * 60 * 60)).toFixed(1);
      avgResolutionTime = `${avgHours} hours`;
    }

    // Calculate trends
    const previousPeriodStart = new Date(start);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - 30);

    const previousTotal = await IssueModel.countDocuments({
      ...where,
      reportedAt: {
        $gte: previousPeriodStart,
        $lt: start,
      },
    });

    const totalTrend =
      previousTotal > 0
        ? (((totalIssues - previousTotal) / previousTotal) * 100).toFixed(1)
        : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalIssues: {
            value: totalIssues,
            trend: `${totalTrend > 0 ? '+' : ''}${totalTrend}%`,
            trendDirection: totalTrend >= 0 ? 'up' : 'down',
          },
          pendingIssues: {
            value: pendingIssues,
            percentage:
              totalIssues > 0 ? ((pendingIssues / totalIssues) * 100).toFixed(1) : 0,
          },
          resolvedToday: {
            value: resolvedToday,
          },
          avgResolutionTime: {
            value: avgResolutionTime,
          },
        },
        charts: {
          categoryBreakdown: categoryBreakdown.map(item => ({
            category: item._id,
            count: item.count,
          })),
          priorityBreakdown: priorityBreakdown.map(item => ({
            priority: item._id,
            count: item.count,
          })),
        },
        recentIssues,
        urgentIssues,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message,
    });
  }
};

/**
 * Get student dashboard
 */
export const getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's issues
    const [myIssues, totalIssues, pendingIssues, resolvedIssues] = await Promise.all([
      IssueModel.find({ reporter: userId, isDeleted: false })
        .sort({ reportedAt: -1 })
        .limit(5)
        .populate('assignedTo', 'fullName'),

      IssueModel.countDocuments({ reporter: userId, isDeleted: false }),

      IssueModel.countDocuments({
        reporter: userId,
        isDeleted: false,
        status: { $in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] },
      }),

      IssueModel.countDocuments({
        reporter: userId,
        isDeleted: false,
        status: { $in: ['RESOLVED', 'CLOSED'] },
      }),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalIssues,
          pendingIssues,
          resolvedIssues,
        },
        myIssues,
      },
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student dashboard',
      error: error.message,
    });
  }
};