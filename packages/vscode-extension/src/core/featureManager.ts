import { getLogger } from './loggingService';

/**
 * FeatureManager - Tracks available/unavailable features and enables graceful degradation
 * 
 * When a feature fails to initialize, it's marked as unavailable.
 * Commands can check feature availability and provide fallbacks.
 * 
 * Validates: Requirements US-5 (Graceful Error Handling)
 */
export class FeatureManager {
  private availableFeatures = new Set<string>();
  private featureErrors = new Map<string, string>();

  /**
   * Register a feature as available
   */
  enable(feature: string): void {
    const logger = getLogger();
    this.availableFeatures.add(feature);
    this.featureErrors.delete(feature);
    logger.debug(`Feature enabled: ${feature}`);
  }

  /**
   * Disable a feature due to error
   */
  disable(feature: string, reason: string): void {
    const logger = getLogger();
    this.availableFeatures.delete(feature);
    this.featureErrors.set(feature, reason);
    logger.warn(`Feature disabled: ${feature} - ${reason}`);
  }

  /**
   * Check if a feature is available
   */
  isAvailable(feature: string): boolean {
    return this.availableFeatures.has(feature);
  }

  /**
   * Get the reason a feature is unavailable
   */
  getDisabledReason(feature: string): string | undefined {
    return this.featureErrors.get(feature);
  }

  /**
   * Execute a feature with fallback
   * If feature is unavailable or operation fails, fallback is used
   */
  async execute<T>(
    feature: string,
    operation: () => Promise<T>,
    fallback: () => T
  ): Promise<T> {
    const logger = getLogger();

    if (!this.isAvailable(feature)) {
      const reason = this.getDisabledReason(feature);
      logger.debug(`Feature ${feature} is unavailable: ${reason}`);
      return fallback();
    }

    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = err.message;
      logger.error(`Feature ${feature} failed:`, err);
      this.disable(feature, errorMessage);
      return fallback();
    }
  }

  /**
   * Execute a sync feature with fallback
   */
  executeSync<T>(
    feature: string,
    operation: () => T,
    fallback: () => T
  ): T {
    const logger = getLogger();

    if (!this.isAvailable(feature)) {
      const reason = this.getDisabledReason(feature);
      logger.debug(`Feature ${feature} is unavailable: ${reason}`);
      return fallback();
    }

    try {
      return operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = err.message;
      logger.error(`Feature ${feature} failed:`, err);
      this.disable(feature, errorMessage);
      return fallback();
    }
  }

  /**
   * Get all available features
   */
  getAvailableFeatures(): string[] {
    return Array.from(this.availableFeatures);
  }

  /**
   * Get all unavailable features with reasons
   */
  getUnavailableFeatures(): Map<string, string> {
    return new Map(this.featureErrors);
  }

  /**
   * Get feature availability report
   */
  getReport(): {
    available: string[];
    unavailable: { feature: string; reason: string }[];
  } {
    return {
      available: this.getAvailableFeatures(),
      unavailable: Array.from(this.featureErrors.entries()).map(([feature, reason]) => ({
        feature,
        reason
      }))
    };
  }

  /**
   * Reset all features to available state
   */
  reset(): void {
    const logger = getLogger();
    this.availableFeatures.clear();
    this.featureErrors.clear();
    logger.debug('Feature manager reset');
  }
}
