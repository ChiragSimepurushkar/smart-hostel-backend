// controllers/analytics.controller.js
import IssueModel from '../models/issue.model.js';
import HostelModel from '../models/hostel.model.js';
import BlockModel from '../models/block.model.js';
import StaffModel from '../models/staff.model.js';
import mongoose from 'mongoose';

/**
 * Get issue trends (last N days) for Line Charts
 */
export const getTrends = async (req, res) => {
  try {
    const { hostelId, days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const matchStage = {
      reportedAt: { $gte: startDate },
      isDeleted: false
    };

    if (hostelId) {
      matchStage.hostel = new mongoose.Types.ObjectId(hostelId);
    }

    const trends = await IssueModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$reportedAt' } },
            category: '$category'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          categories: {
            $push: {
              category: '$_id.category',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formatted = trends.map(day => ({
      date: day._id,
      total: day.totalCount,
      byCategory: day.categories.reduce((acc, cat) => {
        acc[cat.category] = cat.count;
        return acc;
      }, {})
    }));

    res.json({
      success: true,
      data: { trends: formatted, period: `Last ${days} days`, startDate }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching trends', error: error.message });
  }
};

/**
 * Get staff performance metrics for Leaderboards
 */
export const getPerformance = async (req, res) => {
  try {
    const { hostelId, startDate, endDate } = req.query;
    const matchStage = {
      status: { $in: ['RESOLVED', 'CLOSED'] },
      resolvedAt: { $exists: true },
      assignedAt: { $exists: true },
      isDeleted: false
    };

    if (hostelId) matchStage.hostel = new mongoose.Types.ObjectId(hostelId);
    if (startDate) matchStage.reportedAt = { $gte: new Date(startDate) };

    const performance = await IssueModel.aggregate([
      { $match: matchStage },
      {
        $project: {
          category: 1,
          priority: 1,
          resolutionTime: {
            $divide: [{ $subtract: ['$resolvedAt', '$assignedAt'] }, 1000 * 60 * 60]
          },
          responseTime: {
            $divide: [{ $subtract: ['$assignedAt', '$reportedAt'] }, 1000 * 60 * 60]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          avgResponseTime: { $avg: '$responseTime' },
          totalResolved: { $sum: 1 },
          byCategory: { $push: { category: '$category', resolutionTime: '$resolutionTime' } },
          byPriority: { $push: { priority: '$priority', resolutionTime: '$resolutionTime' } }
        }
      }
    ]);

    if (performance.length === 0) {
      return res.json({ success: true, data: { totalResolved: 0, message: 'No data found' } });
    }

    const data = performance[0];
    const calcAvg = (arr, key) => {
      const stats = {};
      arr.forEach(item => {
        if (!stats[item[key]]) stats[item[key]] = { total: 0, sum: 0 };
        stats[item[key]].total++;
        stats[item[key]].sum += item.resolutionTime;
      });
      return Object.entries(stats).map(([name, s]) => ({ name, avg: (s.sum / s.total).toFixed(2), count: s.total }));
    };

    res.json({
      success: true,
      data: {
        overall: {
          avgResolutionTime: data.avgResolutionTime.toFixed(2),
          avgResponseTime: data.avgResponseTime.toFixed(2),
          totalResolved: data.totalResolved
        },
        byCategory: calcAvg(data.byCategory, 'category'),
        byPriority: calcAvg(data.byPriority, 'priority')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Performance error', error: error.message });
  }
};

/**
 * Get Heat Map (Hotspots of problems)
 */
export const getHeatMap = async (req, res) => {
  try {
    const { priority = 'EMERGENCY', days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const heatMapData = await IssueModel.aggregate([
      { $match: { priority, reportedAt: { $gte: startDate }, isDeleted: false } },
      {
        $group: {
          _id: { hostel: '$hostel', block: '$block' },
          count: { $sum: 1 },
          categories: { $push: '$category' }
        }
      },
      { $sort: { count: -1 } },
      { $lookup: { from: 'hostels', localField: '_id.hostel', foreignField: '_id', as: 'hostelInfo' } },
      { $lookup: { from: 'blocks', localField: '_id.block', foreignField: '_id', as: 'blockInfo' } }
    ]);

    const formatted = heatMapData.map(item => ({
      hostel: item.hostelInfo[0]?.name || 'Unknown',
      block: item.blockInfo[0]?.name || 'Unknown',
      count: item.count,
      topCategories: [...new Set(item.categories)].slice(0, 3)
    }));

    res.json({ success: true, data: { heatMap: formatted, totalHotspots: formatted.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Heatmap error', error: error.message });
  }
};

/**
 * Staff Leaderboard
 */
export const getStaffLeaderboard = async (req, res) => {
  try {
    const staff = await StaffModel.find({ isActive: true })
      .select('fullName role totalIssuesHandled avgResolutionTime satisfactionScore')
      .lean();

    const leaderboard = staff.map(s => {
      let score = (s.totalIssuesHandled || 0) * 3;
      if (s.avgResolutionTime) score += Math.max(0, 100 - s.avgResolutionTime * 2);
      if (s.satisfactionScore) score += s.satisfactionScore * 20;
      return { ...s, performanceScore: Math.round(score) };
    }).sort((a, b) => b.performanceScore - a.performanceScore);

    res.json({ success: true, data: { leaderboard: leaderboard.slice(0, 10) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Leaderboard error', error: error.message });
  }
};

/**
 * Dashboard Stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const { hostelId } = req.query;
    const match = hostelId ? { hostel: new mongoose.Types.ObjectId(hostelId), isDeleted: false } : { isDeleted: false };

    const [total, open, resolved, emergency] = await Promise.all([
      IssueModel.countDocuments(match),
      IssueModel.countDocuments({ ...match, status: { $in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] } }),
      IssueModel.countDocuments({ ...match, status: { $in: ['RESOLVED', 'CLOSED'] } }),
      IssueModel.countDocuments({ ...match, priority: 'EMERGENCY', status: { $nin: ['RESOLVED', 'CLOSED'] } })
    ]);

    res.json({
      success: true,
      data: { total, open, resolved, emergency, resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Dashboard stats error', error: error.message });
  }
};

/**
 * Get category distribution (for Pie/Donut Charts)
 */
export const getCategoryDistribution = async (req, res) => {
  try {
    const { hostelId, days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const matchStage = {
      reportedAt: { $gte: startDate },
      isDeleted: false
    };

    if (hostelId) {
      matchStage.hostel = new mongoose.Types.ObjectId(hostelId);
    }

    const distribution = await IssueModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalIssues = distribution.reduce((sum, item) => sum + item.count, 0);

    const formattedData = distribution.map(item => ({
      category: item._id,
      count: item.count,
      percentage: totalIssues > 0 ? ((item.count / totalIssues) * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      data: {
        distribution: formattedData,
        totalIssues,
        period: `Last ${days} days`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching category distribution', error: error.message });
  }
};