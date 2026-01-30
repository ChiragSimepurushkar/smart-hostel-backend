// services/duplicateDetection.service.js

import IssueModel from '../models/issue.model.js';
import aiService from './ai.service.js';

class DuplicateDetectionService {
  /**
   * Check if new issue is a duplicate
   * Returns: { isDuplicate, masterIssue, similarityScore }
   */
  async checkForDuplicate(newIssueData) {
    try {
      const { title, description, category, hostel, block } = newIssueData;

      // Get recent open issues from same location
      const recentIssues = await IssueModel.find({
        hostel,
        block: block || { $exists: true },
        category,
        status: { $in: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS'] },
        isDeleted: false,
        duplicateOf: null, // Only check master issues
        reportedAt: {
          $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }).select('_id title description category priority status duplicateCount reporter');

      if (recentIssues.length === 0) {
        return {
          isDuplicate: false,
          masterIssue: null,
          similarityScore: 0,
          message: 'No similar issues found'
        };
      }

      // Use AI to find duplicates
      const similarIssues = await aiService.findSimilarIssues({
        title,
        description,
        category,
        hostelId: hostel,
        blockId: block
      });

      // Check if any similarity score is above threshold
      const DUPLICATE_THRESHOLD = 0.90; // 90% similarity
      const highestMatch = similarIssues.length > 0 
        ? similarIssues.reduce((prev, current) => 
            (current.similarity_score > prev.similarity_score) ? current : prev
          )
        : null;

      if (highestMatch && highestMatch.similarity_score >= DUPLICATE_THRESHOLD) {
        // Find the full issue details
        const masterIssue = await IssueModel.findById(highestMatch.issue_id)
          .populate('reporter', 'fullName email')
          .populate('assignedTo', 'fullName role')
          .populate('hostel', 'name')
          .populate('block', 'name');

        return {
          isDuplicate: true,
          masterIssue,
          similarityScore: highestMatch.similarity_score,
          message: `This issue is ${(highestMatch.similarity_score * 100).toFixed(0)}% similar to an existing issue`,
          recommendation: this.getDuplicateRecommendation(highestMatch.similarity_score, masterIssue)
        };
      }

      // Similar but not duplicate
      if (similarIssues.length > 0) {
        return {
          isDuplicate: false,
          masterIssue: null,
          similarityScore: highestMatch?.similarity_score || 0,
          similarIssues: similarIssues.slice(0, 3), // Top 3
          message: 'Similar issues found but not exact duplicates'
        };
      }

      return {
        isDuplicate: false,
        masterIssue: null,
        similarityScore: 0,
        message: 'No similar issues found'
      };

    } catch (error) {
      console.error('Duplicate detection error:', error);
      return {
        isDuplicate: false,
        masterIssue: null,
        similarityScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Link new issue as duplicate to master
   */
  async linkDuplicate(newIssueId, masterIssueId, reporterId) {
    try {
      // Update new issue to point to master
      await IssueModel.findByIdAndUpdate(newIssueId, {
        duplicateOf: masterIssueId,
        status: 'CLOSED',
        closedAt: new Date()
      });

      // Update master issue
      await IssueModel.findByIdAndUpdate(masterIssueId, {
        $inc: { duplicateCount: 1 },
        $addToSet: { duplicateReporters: reporterId },
        isDuplicateMaster: true
      });

      return {
        success: true,
        message: 'Issue linked as duplicate'
      };
    } catch (error) {
      console.error('Link duplicate error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create duplicate with auto-link
   */
  async createDuplicateIssue(issueData, masterIssue, reporterId) {
    try {
      // Create the issue
      const newIssue = await IssueModel.create({
        ...issueData,
        duplicateOf: masterIssue._id,
        status: 'CLOSED',
        closedAt: new Date()
      });

      // Update master
      await IssueModel.findByIdAndUpdate(masterIssue._id, {
        $inc: { duplicateCount: 1 },
        $addToSet: { duplicateReporters: reporterId },
        isDuplicateMaster: true
      });

      return {
        success: true,
        newIssue,
        masterIssue,
        message: `Linked to existing issue #${masterIssue._id.toString().slice(-6)}`
      };
    } catch (error) {
      console.error('Create duplicate error:', error);
      throw error;
    }
  }

  /**
   * Get recommendation text based on similarity
   */
  getDuplicateRecommendation(similarityScore, masterIssue) {
    if (similarityScore >= 0.95) {
      return `This appears to be an exact duplicate of Issue #${masterIssue._id.toString().slice(-6)}. We recommend linking to that issue instead of creating a new one.`;
    } else if (similarityScore >= 0.90) {
      return `This is very similar to Issue #${masterIssue._id.toString().slice(-6)} (${masterIssue.status}). Consider linking to that issue to avoid duplicates.`;
    } else if (similarityScore >= 0.80) {
      return `Similar issue found: #${masterIssue._id.toString().slice(-6)}. You may want to check if it's the same problem.`;
    }
    return 'Multiple similar issues detected.';
  }

  /**
   * Get all duplicates of a master issue
   */
  async getDuplicates(masterIssueId) {
    try {
      const duplicates = await IssueModel.find({
        duplicateOf: masterIssueId
      }).populate('reporter', 'fullName email phone hostel block roomNumber');

      return duplicates;
    } catch (error) {
      console.error('Get duplicates error:', error);
      return [];
    }
  }
}

export default new DuplicateDetectionService();