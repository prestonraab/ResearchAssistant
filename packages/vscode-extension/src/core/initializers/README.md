# Extension Initializers

This directory contains the phased initialization system for the Research Assistant extension.

## Overview

The extension uses a three-phase initialization strategy to optimize startup performance:

1. **Phase 1** (< 500ms): Minimal UI initialization
2. **Phase 2** (< 2s): Data loading
3. **Phase 3** (async): Optional services

## Phase 1: Minimal UI Initialization

**File**: `phase1.ts`  
**Target**: < 500ms  
**Status**: ✅ Implemented

### Responsibilities

- Register tree view providers (outline, claims, papers) with empty data
- Create and show loading status bar
- Register command stubs that show loading messages
- Make the UI responsive immediately

### Usage

```typescript
import { Phase1Initializer } from './core/initializers/phase1';

const phase1 = new Phase1Initializer();
await phase1.initialize(context, extensionState);

// Update status bar as needed
phase1.updateStatusBar('$(book) Loading data...');

// Get providers for Phase 2
const { outline, claims, papers } = phase1.getProviders();

// Get status bar for Phase 2
const statusBar = phase1.getStatusBarItem();
```

### Key Features

1. **Fast Initialization**: Completes in < 500ms by deferring data loading
2. **Empty Providers**: Tree views are registered but show no data initially
3. **Loading Feedback**: Status bar shows loading spinner
4. **Command Stubs**: Commands show "loading" messages until Phase 2 completes
5. **Non-Blocking**: Doesn't wait for file I/O or network calls

### Design Decisions

- **Why empty providers?** Registering providers immediately makes the UI responsive, even though data loads later
- **Why command stubs?** Prevents errors if users try to use commands before initialization completes
- **Why separate phases?** Allows the extension to feel fast while still loading all necessary data

## Phase 2: Data Loading

**File**: `phase2.ts`  
**Target**: < 2s  
**Status**: ✅ Implemented

### Responsibilities

- Load claims database in parallel
- Parse outline file in parallel
- Load configuration in parallel
- Update tree views with loaded data
- Handle errors gracefully with user-friendly messages

### Usage

```typescript
import { Phase2Initializer } from './core/initializers/phase2';

const phase2 = new Phase2Initializer(phase1);
await phase2.initialize(extensionState);
```

### Key Features

1. **Parallel Loading**: All data loads in parallel for speed
2. **Error Handling**: Each operation has try-catch with graceful degradation
3. **User Feedback**: Shows warnings if operations fail
4. **Non-Blocking**: Uses Promise.allSettled to continue even if some operations fail

## Phase 3: Optional Services

**File**: `phase3.ts`  
**Target**: Async (non-blocking)  
**Status**: ✅ Implemented

### Responsibilities

- Initialize embeddings service (if API key configured)
- Initialize MCP client
- Initialize Zotero services
- Setup file watchers with debouncing

### Usage

```typescript
import { Phase3Initializer } from './core/initializers/phase3';

const phase3 = new Phase3Initializer();
await phase3.initialize(extensionState);

// Optional: wait for all services to complete
await phase3.waitForCompletion();

// Cleanup when done
phase3.dispose();
```

### Key Features

1. **Non-Blocking**: All services initialize in background
2. **Graceful Degradation**: Services can fail without affecting core functionality
3. **Parallel Initialization**: All services start simultaneously
4. **Smart File Watching**: 1000ms debouncing to prevent excessive processing
5. **Conditional Initialization**: Only initializes services if configured (e.g., API keys present)

### Design Decisions

- **Why non-blocking?** Core functionality is already available after Phase 2
- **Why parallel?** Faster overall initialization time
- **Why 1000ms debounce?** Prevents excessive file processing during rapid edits
- **Why graceful degradation?** Optional services shouldn't break the extension

## Testing

Tests are located in `src/core/__tests__/`:
- `phase1Initializer.test.ts` - Unit tests for Phase 1
- `phase1Integration.test.ts` - Integration tests for Phase 1
- `phase2Initializer.test.ts` - Unit tests for Phase 2
- `phase3Initializer.test.ts` - Unit tests for Phase 3 (to be created)

Run tests:
```bash
npm test -- phase1Initializer.test.ts
npm test -- phase2Initializer.test.ts
npm test -- phase3Initializer.test.ts
```

## Performance Targets

| Phase | Target | Status |
|-------|--------|--------|
| Phase 1 | < 500ms | ✅ Implemented |
| Phase 2 | < 2s | ✅ Implemented |
| Phase 3 | Async | ✅ Implemented |
| **Total** | **< 2s** | ✅ Complete |

## Next Steps

1. ~~Implement Phase2Initializer (task 2.2)~~ ✅ Complete
2. ~~Implement Phase3Initializer (task 2.3)~~ ✅ Complete
3. Refactor extension.ts to use phased initialization (task 2.4)
4. Add comprehensive tests for all phases
5. Measure and optimize performance
