import {
  splitIntoSentences,
  findVagueTerms,
  isUnsupportedStatement,
  extractKeywords,
  getSuggestedClaims,
  analyzeWritingQuality,
  generateFeedbackItems,
  type Sentence
} from '../writingFeedbackLogic';
import { aClaim } from '../../__tests__/helpers';

describe('writingFeedbackLogic', () => {
  describe('splitIntoSentences', () => {
    test('should split text into sentences', () => {
      const text = 'This is the first sentence here. This is the second sentence! This is the third sentence?';
      const sentences = splitIntoSentences(text);
      
      expect(sentences).toHaveLength(3);
      expect(sentences[0].text).toBe('This is the first sentence here.');
      expect(sentences[1].text).toBe('This is the second sentence!');
      expect(sentences[2].text).toBe('This is the third sentence?');
    });

    test('should track sentence offsets', () => {
      const text = 'This is the first sentence here. This is the second sentence here.';
      const sentences = splitIntoSentences(text);
      
      expect(sentences[0].offset).toBe(0);
      expect(sentences[1].offset).toBe(33); // After "This is the first sentence here. "
    });

    test('should skip very short sentences', () => {
      const text = 'This is a long enough sentence. Too short. Another long enough sentence here.';
      const sentences = splitIntoSentences(text);
      
      expect(sentences).toHaveLength(2);
      expect(sentences[0].text).toContain('long enough sentence');
      expect(sentences[1].text).toContain('Another long enough');
    });

    test('should skip headers', () => {
      const text = '# This is a header. This is a regular sentence that is long enough.';
      const sentences = splitIntoSentences(text);
      
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toContain('regular sentence');
    });

    test('should skip list items', () => {
      const text = '- This is a list item. This is a regular sentence that is long enough.';
      const sentences = splitIntoSentences(text);
      
      expect(sentences).toHaveLength(1);
      expect(sentences[0].text).toContain('regular sentence');
    });

    test('should handle empty text', () => {
      const sentences = splitIntoSentences('');
      expect(sentences).toHaveLength(0);
    });

    test('should handle text with no sentences', () => {
      const text = 'No punctuation here';
      const sentences = splitIntoSentences(text);
      expect(sentences).toHaveLength(0);
    });
  });

  describe('findVagueTerms', () => {
    test('should find vague terms in sentence', () => {
      const sentence: Sentence = {
        text: 'Some researchers often use various methods.',
        offset: 0
      };
      
      const matches = findVagueTerms(sentence);
      
      expect(matches).toHaveLength(3);
      expect(matches[0].term).toBe('Some');
      expect(matches[1].term).toBe('often');
      expect(matches[2].term).toBe('various');
    });

    test('should track correct offsets', () => {
      const sentence: Sentence = {
        text: 'Some researchers often use methods.',
        offset: 100
      };
      
      const matches = findVagueTerms(sentence);
      
      expect(matches[0].offset).toBe(100); // "Some" at start
      expect(matches[1].offset).toBe(117); // "often" after "Some researchers "
    });

    test('should match case-insensitively', () => {
      const sentence: Sentence = {
        text: 'SOME researchers OFTEN use VARIOUS methods.',
        offset: 0
      };
      
      const matches = findVagueTerms(sentence);
      
      expect(matches).toHaveLength(3);
      expect(matches[0].term).toBe('SOME');
      expect(matches[1].term).toBe('OFTEN');
      expect(matches[2].term).toBe('VARIOUS');
    });

    test('should match word boundaries only', () => {
      const sentence: Sentence = {
        text: 'Sometimes is vague but sometime is not.',
        offset: 0
      };
      
      const matches = findVagueTerms(sentence);
      
      // Should match "sometimes" but not "sometime"
      expect(matches).toHaveLength(1);
      expect(matches[0].term).toBe('Sometimes');
    });

    test('should return empty array when no vague terms', () => {
      const sentence: Sentence = {
        text: 'This sentence has no vague terms at all.',
        offset: 0
      };
      
      const matches = findVagueTerms(sentence);
      expect(matches).toHaveLength(0);
    });

    test('should find multiple instances of same term', () => {
      const sentence: Sentence = {
        text: 'Some researchers found some interesting results.',
        offset: 0
      };
      
      const matches = findVagueTerms(sentence);
      
      expect(matches).toHaveLength(2);
      expect(matches[0].term).toBe('Some');
      expect(matches[1].term).toBe('some');
    });
  });

  describe('isUnsupportedStatement', () => {
    test('should identify factual statement without citation', () => {
      const sentence: Sentence = {
        text: 'Research shows that this method is effective.',
        offset: 0
      };
      
      expect(isUnsupportedStatement(sentence)).toBe(true);
    });

    test('should not flag statement with claim reference', () => {
      const sentence: Sentence = {
        text: 'Research shows that this method is effective C_01.',
        offset: 0
      };
      
      expect(isUnsupportedStatement(sentence)).toBe(false);
    });

    test('should not flag questions', () => {
      const sentence: Sentence = {
        text: 'Does research show that this method is effective?',
        offset: 0
      };
      
      expect(isUnsupportedStatement(sentence)).toBe(false);
    });

    test('should identify statements with factual indicators', () => {
      const factualSentences = [
        'Studies found significant improvements.',
        'The data suggests a strong correlation.',
        'Analysis revealed important patterns.',
        'Results demonstrated better performance.',
        'Evidence indicates this approach works.'
      ];
      
      for (const text of factualSentences) {
        const sentence: Sentence = { text, offset: 0 };
        expect(isUnsupportedStatement(sentence)).toBe(true);
      }
    });

    test('should not flag non-factual statements', () => {
      const sentence: Sentence = {
        text: 'This is a simple observation without claims.',
        offset: 0
      };
      
      expect(isUnsupportedStatement(sentence)).toBe(false);
    });

    test('should handle claim references in middle of sentence', () => {
      const sentence: Sentence = {
        text: 'Research C_42 shows that this method is effective.',
        offset: 0
      };
      
      expect(isUnsupportedStatement(sentence)).toBe(false);
    });
  });

  describe('extractKeywords', () => {
    test('should extract meaningful keywords', () => {
      const text = 'machine learning algorithms improve performance';
      const keywords = extractKeywords(text);
      
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('algorithms');
      expect(keywords).toContain('improve');
      expect(keywords).toContain('performance');
    });

    test('should filter out common words', () => {
      const text = 'the machine learning algorithm is good';
      const keywords = extractKeywords(text);
      
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('is');
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
    });

    test('should filter out short words', () => {
      const text = 'use big data for analysis';
      const keywords = extractKeywords(text);
      
      expect(keywords).not.toContain('use');
      expect(keywords).not.toContain('big');
      expect(keywords).not.toContain('for');
      expect(keywords).toContain('data');
      expect(keywords).toContain('analysis');
    });

    test('should convert to lowercase', () => {
      const text = 'Machine Learning Algorithms';
      const keywords = extractKeywords(text);
      
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('algorithms');
    });

    test('should handle empty text', () => {
      const keywords = extractKeywords('');
      expect(keywords).toHaveLength(0);
    });

    test('should remove punctuation', () => {
      const text = 'machine-learning, algorithms! performance?';
      const keywords = extractKeywords(text);
      
      expect(keywords).toContain('machine');
      expect(keywords).toContain('learning');
      expect(keywords).toContain('algorithms');
      expect(keywords).toContain('performance');
    });
  });

  describe('getSuggestedClaims', () => {
    test('should suggest claims with matching keywords', () => {
      const claims = [
        aClaim().withId('C_01').withText('Machine learning improves accuracy').build(),
        aClaim().withId('C_02').withText('Deep learning models are effective').build(),
        aClaim().withId('C_03').withText('Statistical methods work well').build()
      ];
      
      const suggestions = getSuggestedClaims('machine learning algorithms', claims);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].id).toBe('C_01'); // Best match
    });

    test('should return empty array when no matches', () => {
      const claims = [
        aClaim().withId('C_01').withText('Completely unrelated topic').build()
      ];
      
      const suggestions = getSuggestedClaims('machine learning', claims);
      
      expect(suggestions).toHaveLength(0);
    });

    test('should sort by relevance score', () => {
      const claims = [
        aClaim().withId('C_01').withText('Machine learning').build(),
        aClaim().withId('C_02').withText('Machine learning algorithms and models').build(),
        aClaim().withId('C_03').withText('Algorithms').build()
      ];
      
      const suggestions = getSuggestedClaims('machine learning algorithms', claims);
      
      // C_02 should rank highest (matches all 3 keywords)
      expect(suggestions[0].id).toBe('C_02');
    });

    test('should handle empty claims array', () => {
      const suggestions = getSuggestedClaims('machine learning', []);
      expect(suggestions).toHaveLength(0);
    });

    test('should return claim id and text', () => {
      const claims = [
        aClaim().withId('C_01').withText('Machine learning improves accuracy').build()
      ];
      
      const suggestions = getSuggestedClaims('machine learning', claims);
      
      expect(suggestions[0]).toEqual({
        id: 'C_01',
        text: 'Machine learning improves accuracy'
      });
    });
  });

  describe('analyzeWritingQuality', () => {
    test('should analyze text for vague terms and unsupported statements', () => {
      const text = 'Some research shows that machine learning is effective. Studies found significant improvements.';
      const claims = [
        aClaim().withId('C_01').withText('Machine learning improves accuracy').build()
      ];
      
      const analysis = analyzeWritingQuality(text, claims);
      
      expect(analysis.sentences.length).toBeGreaterThan(0);
      expect(analysis.vagueTermMatches.length).toBeGreaterThan(0);
      expect(analysis.unsupportedStatements.length).toBeGreaterThan(0);
    });

    test('should find vague terms across all sentences', () => {
      const text = 'Some researchers often use various methods. Many studies frequently show results.';
      const claims: any[] = [];
      
      const analysis = analyzeWritingQuality(text, claims);
      
      // Should find: some, often, various, many, frequently
      expect(analysis.vagueTermMatches.length).toBeGreaterThanOrEqual(5);
    });

    test('should identify unsupported statements', () => {
      const text = 'Research shows this method works. Studies found improvements.';
      const claims: any[] = [];
      
      const analysis = analyzeWritingQuality(text, claims);
      
      expect(analysis.unsupportedStatements).toHaveLength(2);
    });

    test('should suggest relevant claims for unsupported statements', () => {
      const text = 'Machine learning research shows significant improvements.';
      const claims = [
        aClaim().withId('C_01').withText('Machine learning improves accuracy').build(),
        aClaim().withId('C_02').withText('Deep learning is effective').build()
      ];
      
      const analysis = analyzeWritingQuality(text, claims);
      
      expect(analysis.unsupportedStatements[0].suggestedClaims.length).toBeGreaterThan(0);
      expect(analysis.unsupportedStatements[0].suggestedClaims[0].id).toBe('C_01');
    });

    test('should handle text with no issues', () => {
      const text = 'This is a simple sentence without issues.';
      const claims: any[] = [];
      
      const analysis = analyzeWritingQuality(text, claims);
      
      expect(analysis.vagueTermMatches).toHaveLength(0);
      expect(analysis.unsupportedStatements).toHaveLength(0);
    });

    test('should handle empty text', () => {
      const analysis = analyzeWritingQuality('', []);
      
      expect(analysis.sentences).toHaveLength(0);
      expect(analysis.vagueTermMatches).toHaveLength(0);
      expect(analysis.unsupportedStatements).toHaveLength(0);
    });
  });

  describe('generateFeedbackItems', () => {
    test('should generate feedback for vague terms', () => {
      const text = 'Some researchers often use methods.';
      const analysis = analyzeWritingQuality(text, []);
      
      const feedback = generateFeedbackItems(analysis);
      
      const vagueFeedback = feedback.filter(f => f.type === 'vagueness');
      expect(vagueFeedback.length).toBeGreaterThan(0);
      expect(vagueFeedback[0].message).toContain('Vague term detected');
    });

    test('should generate feedback for unsupported statements', () => {
      const text = 'Research shows that this method is effective.';
      const analysis = analyzeWritingQuality(text, []);
      
      const feedback = generateFeedbackItems(analysis);
      
      const citationFeedback = feedback.filter(f => f.type === 'missing-citation');
      expect(citationFeedback).toHaveLength(1);
      expect(citationFeedback[0].message).toContain('Unsupported statement');
    });

    test('should include suggested claims in feedback', () => {
      const text = 'Machine learning research shows improvements.';
      const claims = [
        aClaim().withId('C_01').withText('Machine learning improves accuracy').build()
      ];
      const analysis = analyzeWritingQuality(text, claims);
      
      const feedback = generateFeedbackItems(analysis);
      
      const citationFeedback = feedback.find(f => f.type === 'missing-citation');
      expect(citationFeedback?.message).toContain('C_01');
      expect(citationFeedback?.suggestions).toContain('Add C_01');
    });

    test('should provide generic suggestion when no claims match', () => {
      const text = 'Research shows this method works.';
      const analysis = analyzeWritingQuality(text, []);
      
      const feedback = generateFeedbackItems(analysis);
      
      const citationFeedback = feedback.find(f => f.type === 'missing-citation');
      expect(citationFeedback?.message).toContain('Add a claim reference');
      expect(citationFeedback?.suggestions).toContain('Search for evidence');
    });

    test('should include correct offsets and lengths', () => {
      const text = 'Some research shows results.';
      const analysis = analyzeWritingQuality(text, []);
      
      const feedback = generateFeedbackItems(analysis);
      
      for (const item of feedback) {
        expect(item.offset).toBeGreaterThanOrEqual(0);
        expect(item.length).toBeGreaterThan(0);
      }
    });

    test('should limit suggested claims to 3', () => {
      const text = 'Machine learning research shows improvements.';
      const claims = [
        aClaim().withId('C_01').withText('Machine learning improves accuracy').build(),
        aClaim().withId('C_02').withText('Machine learning is effective').build(),
        aClaim().withId('C_03').withText('Machine learning works well').build(),
        aClaim().withId('C_04').withText('Machine learning shows results').build()
      ];
      const analysis = analyzeWritingQuality(text, claims);
      
      const feedback = generateFeedbackItems(analysis);
      
      const citationFeedback = feedback.find(f => f.type === 'missing-citation');
      // Count how many claim IDs appear in the message
      const claimMatches = citationFeedback?.message.match(/C_\d+/g);
      expect(claimMatches?.length).toBeLessThanOrEqual(3);
    });

    test('should handle empty analysis', () => {
      const analysis = {
        sentences: [],
        vagueTermMatches: [],
        unsupportedStatements: []
      };
      
      const feedback = generateFeedbackItems(analysis);
      
      expect(feedback).toHaveLength(0);
    });

    test('should truncate long claim text in suggestions', () => {
      const longText = 'Machine learning research shows that ' + 'a'.repeat(100);
      const text = 'Machine learning research shows improvements.';
      const claims = [
        aClaim().withId('C_01').withText(longText).build()
      ];
      const analysis = analyzeWritingQuality(text, claims);
      
      const feedback = generateFeedbackItems(analysis);
      
      const citationFeedback = feedback.find(f => f.type === 'missing-citation');
      expect(citationFeedback?.message).toContain('...');
    });
  });
});
