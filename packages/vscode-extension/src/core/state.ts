/**
 * Re-export from modular state structure for backward compatibility.
 * 
 * The ExtensionState class has been refactored into:
 * - CoreState: Core extension state (context, disposables, configuration)
 * - ServiceState: Service-related state (managers, services)
 * - UIState: UI-related state (providers, views)
 * 
 * See src/core/state/ directory for the modular implementation.
 */
export { ExtensionState, ExtensionConfig, CoreState, ServiceState, UIState } from './state/index';
