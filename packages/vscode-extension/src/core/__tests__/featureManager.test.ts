import { FeatureManager } from '../featureManager';

describe('FeatureManager', () => {
  let featureManager: FeatureManager;

  beforeEach(() => {
    featureManager = new FeatureManager();
  });

  describe('Feature availability', () => {
    it('should enable features', () => {
      featureManager.enable('feature1');
      expect(featureManager.isAvailable('feature1')).toBe(true);
    });

    it('should disable features', () => {
      featureManager.enable('feature1');
      featureManager.disable('feature1', 'test reason');
      expect(featureManager.isAvailable('feature1')).toBe(false);
    });

    it('should track disabled reason', () => {
      featureManager.disable('feature1', 'API key missing');
      expect(featureManager.getDisabledReason('feature1')).toBe('API key missing');
    });

    it('should return undefined for available features', () => {
      featureManager.enable('feature1');
      expect(featureManager.getDisabledReason('feature1')).toBeUndefined();
    });

    it('should handle multiple features', () => {
      featureManager.enable('feature1');
      featureManager.enable('feature2');
      featureManager.disable('feature3', 'not initialized');

      expect(featureManager.isAvailable('feature1')).toBe(true);
      expect(featureManager.isAvailable('feature2')).toBe(true);
      expect(featureManager.isAvailable('feature3')).toBe(false);
    });
  });

  describe('Feature execution', () => {
    it('should execute available features', async () => {
      featureManager.enable('feature1');

      const result = await featureManager.execute(
        'feature1',
        async () => 'success',
        () => 'fallback'
      );

      expect(result).toBe('success');
    });

    it('should use fallback for unavailable features', async () => {
      featureManager.disable('feature1', 'not available');

      const result = await featureManager.execute(
        'feature1',
        async () => 'success',
        () => 'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('should disable feature on error', async () => {
      featureManager.enable('feature1');

      const result = await featureManager.execute(
        'feature1',
        async () => {
          throw new Error('operation failed');
        },
        () => 'fallback'
      );

      expect(result).toBe('fallback');
      expect(featureManager.isAvailable('feature1')).toBe(false);
    });

    it('should track error reason when feature fails', async () => {
      featureManager.enable('feature1');

      await featureManager.execute(
        'feature1',
        async () => {
          throw new Error('specific error');
        },
        () => 'fallback'
      );

      const reason = featureManager.getDisabledReason('feature1');
      expect(reason).toContain('specific error');
    });
  });

  describe('Sync feature execution', () => {
    it('should execute available sync features', () => {
      featureManager.enable('feature1');

      const result = featureManager.executeSync(
        'feature1',
        () => 'success',
        () => 'fallback'
      );

      expect(result).toBe('success');
    });

    it('should use fallback for unavailable sync features', () => {
      featureManager.disable('feature1', 'not available');

      const result = featureManager.executeSync(
        'feature1',
        () => 'success',
        () => 'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('should disable feature on sync error', () => {
      featureManager.enable('feature1');

      const result = featureManager.executeSync(
        'feature1',
        () => {
          throw new Error('operation failed');
        },
        () => 'fallback'
      );

      expect(result).toBe('fallback');
      expect(featureManager.isAvailable('feature1')).toBe(false);
    });
  });

  describe('Feature reporting', () => {
    it('should list available features', () => {
      featureManager.enable('feature1');
      featureManager.enable('feature2');
      featureManager.disable('feature3', 'not available');

      const available = featureManager.getAvailableFeatures();
      expect(available).toContain('feature1');
      expect(available).toContain('feature2');
      expect(available).not.toContain('feature3');
    });

    it('should list unavailable features with reasons', () => {
      featureManager.disable('feature1', 'reason1');
      featureManager.disable('feature2', 'reason2');

      const unavailable = featureManager.getUnavailableFeatures();
      expect(unavailable.get('feature1')).toBe('reason1');
      expect(unavailable.get('feature2')).toBe('reason2');
    });

    it('should generate availability report', () => {
      featureManager.enable('feature1');
      featureManager.enable('feature2');
      featureManager.disable('feature3', 'not available');

      const report = featureManager.getReport();

      expect(report.available).toContain('feature1');
      expect(report.available).toContain('feature2');
      expect(report.unavailable).toContainEqual({
        feature: 'feature3',
        reason: 'not available'
      });
    });
  });

  describe('Feature reset', () => {
    it('should reset all features', () => {
      featureManager.enable('feature1');
      featureManager.enable('feature2');
      featureManager.disable('feature3', 'not available');

      featureManager.reset();

      expect(featureManager.getAvailableFeatures()).toHaveLength(0);
      expect(featureManager.getUnavailableFeatures().size).toBe(0);
    });

    it('should allow re-enabling after reset', () => {
      featureManager.enable('feature1');
      featureManager.reset();
      featureManager.enable('feature1');

      expect(featureManager.isAvailable('feature1')).toBe(true);
    });
  });

  describe('Property-based tests', () => {
    it('should maintain consistency between enable/disable and isAvailable', () => {
      const features = ['f1', 'f2', 'f3', 'f4', 'f5'];

      for (const feature of features) {
        featureManager.enable(feature);
        expect(featureManager.isAvailable(feature)).toBe(true);

        featureManager.disable(feature, 'test');
        expect(featureManager.isAvailable(feature)).toBe(false);
      }
    });

    it('should never have feature in both available and unavailable lists', () => {
      featureManager.enable('feature1');
      featureManager.enable('feature2');
      featureManager.disable('feature3', 'reason');

      const available = new Set(featureManager.getAvailableFeatures());
      const unavailable = featureManager.getUnavailableFeatures();

      for (const feature of available) {
        expect(unavailable.has(feature)).toBe(false);
      }

      for (const feature of unavailable.keys()) {
        expect(available.has(feature)).toBe(false);
      }
    });

    it('should always return fallback when feature is unavailable', async () => {
      featureManager.disable('feature1', 'not available');

      const result = await featureManager.execute(
        'feature1',
        async () => 'should not be called',
        () => 'fallback'
      );

      expect(result).toBe('fallback');
    });

    it('should handle rapid enable/disable cycles', () => {
      for (let i = 0; i < 100; i++) {
        featureManager.enable('feature1');
        expect(featureManager.isAvailable('feature1')).toBe(true);

        featureManager.disable('feature1', 'reason');
        expect(featureManager.isAvailable('feature1')).toBe(false);
      }
    });
  });
});
