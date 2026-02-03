import { getLogger } from './loggingService';

/**
 * ServiceFactory - Lazy initialization pattern for services
 * 
 * Provides:
 * - Service registration with initializers
 * - Lazy initialization on first access
 * - Service availability tracking
 * - Caching of initialized services
 * 
 * Validates: Requirements US-1 (Fast Activation)
 */
export class ServiceFactory {
  private services: Map<string, any> = new Map();
  private initializers: Map<string, () => Promise<any>> = new Map();
  private initializationPromises: Map<string, Promise<any>> = new Map();
  private logger = getLogger();

  /**
   * Register a service initializer
   * 
   * @param name - Service name
   * @param initializer - Async function that initializes the service
   */
  register<T>(name: string, initializer: () => Promise<T>): void {
    if (this.initializers.has(name)) {
      this.logger.warn(`Service '${name}' already registered, overwriting`);
    }
    this.initializers.set(name, initializer);
  }

  /**
   * Get service, initializing if needed
   * 
   * @param name - Service name
   * @returns Initialized service
   * @throws Error if service not registered or initialization fails
   */
  async get<T>(name: string): Promise<T> {
    // Return cached service if available
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Return existing initialization promise if in progress
    if (this.initializationPromises.has(name)) {
      return this.initializationPromises.get(name) as Promise<T>;
    }

    // Initialize service
    const initializer = this.initializers.get(name);
    if (!initializer) {
      throw new Error(`Service not registered: ${name}`);
    }

    // Create initialization promise
    const initPromise = (async () => {
      try {
        this.logger.debug(`Initializing service: ${name}`);
        const service = await initializer();
        this.services.set(name, service);
        this.logger.debug(`Service initialized: ${name}`);
        return service;
      } catch (error) {
        this.logger.error(`Failed to initialize service '${name}':`, error instanceof Error ? error : undefined);
        throw error;
      } finally {
        this.initializationPromises.delete(name);
      }
    })();

    this.initializationPromises.set(name, initPromise);
    return initPromise as Promise<T>;
  }

  /**
   * Check if service is initialized
   * 
   * @param name - Service name
   * @returns true if service is initialized, false otherwise
   */
  isInitialized(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Check if service is currently initializing
   * 
   * @param name - Service name
   * @returns true if service is being initialized, false otherwise
   */
  isInitializing(name: string): boolean {
    return this.initializationPromises.has(name);
  }

  /**
   * Check if service is registered
   * 
   * @param name - Service name
   * @returns true if service is registered, false otherwise
   */
  isRegistered(name: string): boolean {
    return this.initializers.has(name);
  }

  /**
   * Get list of all registered service names
   * 
   * @returns Array of service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.initializers.keys());
  }

  /**
   * Get list of initialized service names
   * 
   * @returns Array of initialized service names
   */
  getInitializedServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Dispose a service
   * 
   * @param name - Service name
   */
  async dispose(name: string): Promise<void> {
    const service = this.services.get(name);
    if (service && typeof service.dispose === 'function') {
      try {
        await service.dispose();
      } catch (error) {
        this.logger.error(`Failed to dispose service '${name}':`, error instanceof Error ? error : undefined);
      }
    }
    this.services.delete(name);
  }

  /**
   * Dispose all services
   */
  async disposeAll(): Promise<void> {
    const serviceNames = Array.from(this.services.keys());
    for (const name of serviceNames) {
      await this.dispose(name);
    }
  }

  /**
   * Clear all services and initializers
   */
  clear(): void {
    this.services.clear();
    this.initializers.clear();
    this.initializationPromises.clear();
  }
}
