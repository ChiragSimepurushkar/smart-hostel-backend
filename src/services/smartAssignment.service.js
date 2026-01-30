// backend/services/smartAssignment.service.js
import StaffModel from '../models/staff.model.js';
import IssueModel from '../models/issue.model.js';

class SmartAssignmentService {
  /**
   * Category to Staff Role mapping
   */
  categoryToRoleMap = {
    'PLUMBING': ['PLUMBER', 'GENERAL_MAINTENANCE'],
    'ELECTRICAL': ['ELECTRICIAN', 'GENERAL_MAINTENANCE'],
    'CLEANLINESS': ['CLEANER'],
    'INTERNET': ['IT_SUPPORT'],
    'FURNITURE': ['CARPENTER', 'GENERAL_MAINTENANCE'],
    'MAINTENANCE': ['GENERAL_MAINTENANCE', 'CARPENTER'],
    'MESS_FOOD': ['MESS_MANAGER'],
    'SECURITY': ['SECURITY'],
    'MEDICAL': ['MEDICAL'],
    'OTHER': ['GENERAL_MAINTENANCE']
  };

  /**
   * Priority weight factors
   */
  priorityWeights = {
    'EMERGENCY': 5.0,
    'HIGH': 3.0,
    'MEDIUM': 1.5,
    'LOW': 1.0
  };

  /**
   * Main function: Get smart staff recommendations for an issue
   */
  async getStaffRecommendations(issue, aiAnalysis) {
    try {
      const category = aiAnalysis.aiCategory || issue.category;
      const priority = aiAnalysis.aiPriority || issue.priority;
      const confidence = aiAnalysis.confidence || 0;

      // Get eligible staff based on category
      const eligibleStaff = await this.findEligibleStaff({
        category,
        hostelId: issue.hostel,
        blockId: issue.block,
      });

      if (eligibleStaff.length === 0) {
        return {
          success: false,
          message: 'No staff available for this category',
          recommendations: []
        };
      }

      // Score each staff member
      const scoredStaff = await this.scoreStaff(eligibleStaff, {
        category,
        priority,
        aiConfidence: confidence,
        hostelId: issue.hostel,
        blockId: issue.block,
      });

      // Sort by score (highest first)
      const recommendations = scoredStaff
        .sort((a, b) => b.score - a.score)
        .slice(0, 3) // Top 3 recommendations
        .map((item, index) => ({
          rank: index + 1,
          staff: item.staff,
          score: item.score,
          reason: item.reason,
          shouldAutoAssign: index === 0 && confidence > 0.85 && item.score > 70,
        }));

      return {
        success: true,
        recommendations,
        autoAssignRecommended: recommendations[0]?.shouldAutoAssign || false,
        aiConfidence: confidence,
      };
    } catch (error) {
      console.error('Smart assignment error:', error);
      return {
        success: false,
        message: 'Error generating recommendations',
        recommendations: []
      };
    }
  }

  /**
   * Find staff eligible for the issue category
   */
  async findEligibleStaff({ category, hostelId, blockId }) {
    // Get roles that can handle this category
    const eligibleRoles = this.categoryToRoleMap[category] || ['GENERAL_MAINTENANCE'];

    // Build query
    const query = {
      isActive: true,
      $or: [
        { expertiseCategories: category },
        { role: { $in: eligibleRoles } }
      ]
    };

    // Prefer staff assigned to this hostel/block
    if (hostelId) {
      query.$or.push({ assignedHostels: hostelId });
    }
    if (blockId) {
      query.$or.push({ assignedBlocks: blockId });
    }

    const staff = await StaffModel.find(query)
      .select('fullName role phone email expertiseCategories currentWorkload avgResolutionTime satisfactionScore assignedHostels assignedBlocks')
      .lean();

    return staff;
  }

  /**
   * Score each staff member based on multiple factors
   */
  async scoreStaff(staffList, { category, priority, aiConfidence, hostelId, blockId }) {
    const priorityWeight = this.priorityWeights[priority] || 1.0;

    const scored = await Promise.all(
      staffList.map(async (staff) => {
        let score = 0;
        const reasons = [];

        // 1. Expertise Match (30 points)
        if (staff.expertiseCategories?.includes(category)) {
          score += 30;
          reasons.push('Expert in this category');
        } else if (this.categoryToRoleMap[category]?.includes(staff.role)) {
          score += 20;
          reasons.push('Role matches category');
        }

        // 2. Workload (25 points) - Prefer less busy staff
        const workloadScore = Math.max(0, 25 - (staff.currentWorkload || 0) * 5);
        score += workloadScore;
        if (staff.currentWorkload === 0) {
          reasons.push('Currently available');
        } else if (staff.currentWorkload < 3) {
          reasons.push('Light workload');
        }

        // 3. Location Match (20 points)
        if (staff.assignedHostels?.some(h => h.toString() === hostelId?.toString())) {
          score += 15;
          reasons.push('Assigned to this hostel');
        }
        if (staff.assignedBlocks?.some(b => b.toString() === blockId?.toString())) {
          score += 5;
          reasons.push('Assigned to this block');
        }

        // 4. Performance History (15 points)
        if (staff.avgResolutionTime && staff.avgResolutionTime < 48) {
          score += 10;
          reasons.push(`Fast resolver (${staff.avgResolutionTime.toFixed(1)}h avg)`);
        }
        if (staff.satisfactionScore && staff.satisfactionScore > 4.0) {
          score += 5;
          reasons.push(`High satisfaction (${staff.satisfactionScore.toFixed(1)}/5)`);
        }

        // 5. Priority Adjustment (10 points)
        if (priority === 'EMERGENCY') {
          // For emergencies, heavily favor available staff
          if (staff.currentWorkload === 0) {
            score += 10;
            reasons.push('Available for emergency');
          }
        }

        // 6. AI Confidence Bonus (applies to top match only)
        if (aiConfidence > 0.85 && score > 50) {
          const confidenceBonus = Math.round(aiConfidence * 10);
          score += confidenceBonus;
          reasons.push(`AI confidence: ${(aiConfidence * 100).toFixed(0)}%`);
        }

        // Apply priority multiplier
        score = score * priorityWeight;

        return {
          staff: {
            _id: staff._id,
            fullName: staff.fullName,
            role: staff.role,
            phone: staff.phone,
            email: staff.email,
            currentWorkload: staff.currentWorkload || 0,
            avgResolutionTime: staff.avgResolutionTime || null,
            satisfactionScore: staff.satisfactionScore || null,
          },
          score: Math.round(score),
          reason: reasons.join(', '),
        };
      })
    );

    return scored;
  }

  /**
   * Auto-assign issue to best staff member
   */
  async autoAssignIssue(issueId, recommendations) {
    try {
      if (!recommendations || recommendations.length === 0) {
        return {
          success: false,
          message: 'No recommendations available for auto-assignment'
        };
      }

      const topRecommendation = recommendations[0];
      
      if (!topRecommendation.shouldAutoAssign) {
        return {
          success: false,
          message: 'Auto-assignment confidence too low',
          topRecommendation
        };
      }

      // Update issue
      const issue = await IssueModel.findByIdAndUpdate(
        issueId,
        {
          assignedTo: topRecommendation.staff._id,
          assignedAt: new Date(),
          status: 'ASSIGNED',
        },
        { new: true }
      ).populate('assignedTo', 'fullName role phone email');

      // Update staff workload
      await StaffModel.findByIdAndUpdate(
        topRecommendation.staff._id,
        { $inc: { currentWorkload: 1 } }
      );

      return {
        success: true,
        message: `Auto-assigned to ${topRecommendation.staff.fullName}`,
        issue,
        assignedStaff: topRecommendation.staff,
        confidence: topRecommendation.score,
      };
    } catch (error) {
      console.error('Auto-assignment error:', error);
      return {
        success: false,
        message: 'Error during auto-assignment',
        error: error.message
      };
    }
  }

  /**
   * Update staff workload when issue status changes
   */
  async updateStaffWorkload(staffId, changeType) {
    try {
      if (changeType === 'assign' || changeType === 'reopen') {
        await StaffModel.findByIdAndUpdate(staffId, { $inc: { currentWorkload: 1 } });
      } else if (changeType === 'resolve' || changeType === 'close') {
        await StaffModel.findByIdAndUpdate(staffId, { $inc: { currentWorkload: -1 } });
      }
    } catch (error) {
      console.error('Workload update error:', error);
    }
  }

  /**
   * Calculate staff performance metrics
   */
  async calculateStaffPerformance(staffId) {
    try {
      const resolvedIssues = await IssueModel.find({
        assignedTo: staffId,
        status: { $in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { $exists: true },
      });

      if (resolvedIssues.length === 0) {
        return null;
      }

      // Calculate average resolution time
      const totalTime = resolvedIssues.reduce((sum, issue) => {
        const time = (new Date(issue.resolvedAt) - new Date(issue.assignedAt)) / (1000 * 60 * 60); // hours
        return sum + time;
      }, 0);

      const avgResolutionTime = totalTime / resolvedIssues.length;

      // Update staff record
      await StaffModel.findByIdAndUpdate(staffId, {
        totalIssuesHandled: resolvedIssues.length,
        avgResolutionTime: avgResolutionTime,
      });

      return {
        totalIssuesHandled: resolvedIssues.length,
        avgResolutionTime: avgResolutionTime.toFixed(2),
      };
    } catch (error) {
      console.error('Performance calculation error:', error);
      return null;
    }
  }
}

export default new SmartAssignmentService();