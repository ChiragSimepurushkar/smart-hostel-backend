// services/mlService.js
import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

class MLService {
  /**
   * Predict issue category and priority
   */
  async analyzeIssue({ title, description, userCategory, userPriority }) {
    try {
      const fullText = `${title} ${description}`;

      const response = await axios.post(`${ML_SERVICE_URL}/predict/combined`, {
        description: fullText
      }, {
        timeout: 5000  // 5 second timeout
      });

      if (response.data.success) {
        return {
          category: userCategory || response.data.category,
          priority: userPriority || response.data.priority,
          aiCategory: response.data.category,
          aiPriority: response.data.priority,
          confidence: response.data.category_confidence,
          reasoning: `AI suggested ${response.data.category} with ${(response.data.category_confidence * 100).toFixed(1)}% confidence`
        };
      }

      // Fallback if ML service fails
      return this.fallbackAnalysis({ title, description, userCategory, userPriority });

    } catch (error) {
      console.error('ML Service error:', error.message);
      // Fallback to rule-based system
      return this.fallbackAnalysis({ title, description, userCategory, userPriority });
    }
  }

  /**
   * Find similar issues
   */
  async findSimilarIssues({ title, description, hostelId, blockId, existingIssues }) {
    try {
      const fullText = `${title} ${description}`;

      const response = await axios.post(`${ML_SERVICE_URL}/find_similar`, {
        description: fullText,
        existing_issues: existingIssues.map(issue => ({
          id: issue._id.toString(),
          title: issue.title,
          description: issue.description
        }))
      }, {
        timeout: 5000
      });

      if (response.data.success) {
        return response.data.similar_issues;
      }

      return [];

    } catch (error) {
      console.error('Find similar issues error:', error.message);
      return [];
    }
  }

  /**
   * Fallback rule-based analysis when ML service is unavailable
   */
  fallbackAnalysis({ title, description, userCategory, userPriority }) {
    const text = `${title} ${description}`.toLowerCase();

    // Rule-based category detection
    const categoryKeywords = {
      PLUMBING: ['water', 'tap', 'toilet', 'leak', 'drain', 'flush', 'shower', 'pipe'],
      ELECTRICAL: ['light', 'fan', 'power', 'socket', 'electricity', 'switch', 'wire', 'ac', 'bulb'],
      CLEANLINESS: ['clean', 'garbage', 'dirt', 'smell', 'pest', 'cockroach', 'rat', 'dustbin'],
      INTERNET: ['wifi', 'internet', 'network', 'router', 'lan', 'connection'],
      FURNITURE: ['bed', 'chair', 'table', 'cupboard', 'desk', 'shelf', 'door', 'window'],
      MAINTENANCE: ['paint', 'crack', 'repair', 'fix', 'broken', 'damage'],
      MESS_FOOD: ['food', 'mess', 'meal', 'dinner', 'lunch', 'breakfast', 'kitchen'],
      SECURITY: ['security', 'lock', 'gate', 'cctv', 'guard', 'safety', 'fire']
    };

    let detectedCategory = userCategory || 'OTHER';
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedCategory = category;
      }
    }

    // Rule-based priority detection
    const emergencyKeywords = ['emergency', 'urgent', 'immediately', 'dangerous', 'fire', 'flood', 'gas leak'];
    const highKeywords = ['broken', 'not working', 'severe', 'major', 'critical'];
    const mediumKeywords = ['need', 'require', 'should', 'problem'];

    let detectedPriority = userPriority || 'LOW';

    if (emergencyKeywords.some(keyword => text.includes(keyword))) {
      detectedPriority = 'EMERGENCY';
    } else if (highKeywords.some(keyword => text.includes(keyword))) {
      detectedPriority = 'HIGH';
    } else if (mediumKeywords.some(keyword => text.includes(keyword))) {
      detectedPriority = 'MEDIUM';
    }

    return {
      category: detectedCategory,
      priority: detectedPriority,
      aiCategory: detectedCategory,
      aiPriority: detectedPriority,
      confidence: 0.7,
      reasoning: 'Rule-based analysis (ML service unavailable)'
    };
  }

  /**
   * Check if ML service is available
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
      return response.data.status === 'OK';
    } catch (error) {
      return false;
    }
  }
}

export default new MLService();