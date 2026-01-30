import axios from 'axios';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:5002';

class AIService {
  /**
   * Main Entry: Analyze issue with ML categorization and RAG solution suggestions
   */
  async analyzeIssue(issueData) {
    try {
      const { title, description, userCategory, userPriority } = issueData;
      const fullText = `${title} ${description}`;

      // Step 1: Get classification from ML Service
      let mlPredictions;
      try {
        const mlResponse = await axios.post(`${ML_SERVICE_URL}/predict/combined`, {
          description: fullText
        }, { timeout: 5000 });

        if (mlResponse.data.success) {
          mlPredictions = mlResponse.data.data;
        }
      } catch (mlError) {
        console.warn('⚠️ ML service unavailable, using keyword fallback for classification');
      }

      // If ML failed, use keyword-based fallback
      const baseAnalysis = mlPredictions 
        ? {
            category: userCategory || mlPredictions.category,
            priority: userPriority || mlPredictions.priority,
            aiCategory: mlPredictions.category,
            aiPriority: mlPredictions.priority,
            confidence: mlPredictions.category_confidence,
            reasoning: `AI suggested ${mlPredictions.category} (${(mlPredictions.category_confidence * 100).toFixed(1)}% confidence)`
          }
        : this.fallbackAnalysis(issueData);

      // Step 2: Get solution suggestions from RAG Service
      let ragSuggestions = null;
      try {
        const ragResponse = await axios.post(`${RAG_SERVICE_URL}/suggest_solution`, {
          description: fullText,
          category: baseAnalysis.category,
          priority: baseAnalysis.priority
        }, { timeout: 10000 });

        if (ragResponse.data.success) {
          ragSuggestions = ragResponse.data.data;
        }
      } catch (ragError) {
        console.warn('⚠️ RAG service unavailable, skipping solution suggestions');
      }

      // Step 3: Combine everything
      return {
        ...baseAnalysis,
        suggestedSolution: ragSuggestions?.solution || null,
        similarPastIssues: ragSuggestions?.similar_issues || [],
        estimatedResolutionTime: this._estimateTimeFromSimilar(ragSuggestions?.similar_issues),
        recommendedStaff: this._extractStaffFromSimilar(ragSuggestions?.similar_issues)
      };

    } catch (error) {
      console.error('AI Service Error:', error.message);
      return this.fallbackAnalysis(issueData);
    }
  }

  /**
   * Find similar open issues (Used for Duplicate Prevention)
   */
  async findSimilarIssues({ title, description, existingIssues }) {
    try {
      const response = await axios.post(`${ML_SERVICE_URL}/find_similar`, {
        description: `${title} ${description}`,
        existing_issues: existingIssues.map(issue => ({
          id: issue._id.toString(),
          title: issue.title,
          description: issue.description
        }))
      }, { timeout: 5000 });

      return response.data.success ? response.data.data.similar_issues : [];
    } catch (error) {
      console.error('Find similar issues error:', error.message);
      return [];
    }
  }

  /**
   * Add resolved issue to RAG knowledge base for future suggestions
   */
  async addToKnowledgeBase(issueData) {
    try {
      await axios.post(`${RAG_SERVICE_URL}/add_solution`, {
        id: issueData.issueId,
        title: issueData.title,
        description: issueData.description,
        category: issueData.category,
        priority: issueData.priority,
        solution: issueData.solution,
        staff: issueData.staffName,
        resolution_time: issueData.resolutionTimeHours,
        hostel: issueData.hostelName
      }, { timeout: 5000 });
      return { success: true };
    } catch (error) {
      console.error('Failed to add to RAG knowledge base:', error.message);
      return { success: false };
    }
  }

  /**
   * Rule-based fallback if ML/RAG services are down
   */
  fallbackAnalysis({ title, description, userCategory, userPriority }) {
    const text = `${title} ${description}`.toLowerCase();
    const categoryKeywords = {
      PLUMBING: ['water', 'tap', 'toilet', 'leak', 'drain', 'pipe'],
      ELECTRICAL: ['light', 'fan', 'power', 'socket', 'electricity', 'wire'],
      CLEANLINESS: ['clean', 'garbage', 'dirt', 'pest', 'smell'],
      INTERNET: ['wifi', 'internet', 'network', 'router'],
      SECURITY: ['lock', 'gate', 'guard', 'safety']
    };

    let detectedCategory = userCategory || 'OTHER';
    let maxMatches = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const matches = keywords.filter(k => text.includes(k)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedCategory = category;
      }
    }

    const priority = text.includes('emergency') || text.includes('fire') ? 'EMERGENCY' : 
                     text.includes('broken') || text.includes('severe') ? 'HIGH' : 'MEDIUM';

    return {
      category: detectedCategory,
      priority: userPriority || priority,
      aiCategory: detectedCategory,
      aiPriority: priority,
      confidence: 0.7,
      reasoning: 'Rule-based analysis (ML service offline)'
    };
  }

  _estimateTimeFromSimilar(issues) {
    if (!issues || issues.length === 0) return null;
    const times = issues.map(i => i.resolution_time).filter(t => t > 0);
    if (times.length === 0) return null;
    return Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10;
  }

  _extractStaffFromSimilar(issues) {
    if (!issues || issues.length === 0) return null;
    const counts = {};
    issues.forEach(i => { if (i.staff) counts[i.staff] = (counts[i.staff] || 0) + 1; });
    const entries = Object.entries(counts);
    return entries.length > 0 ? entries.sort((a, b) => b[1] - a[1])[0][0] : null;
  }
}

export default new AIService();