# Data Flow Fixes - Mode Handoff Improvements

## Overview
This document describes the comprehensive fixes made to prevent data loss and synchronization issues when switching between modes (Editing, Writing, Claim Review, Claim Matching).

## Issues Fixed

### 1. Quote Addition Flow (Original Issue)
**Problem**: When user selected a quote in Claim Review, it wasn't being added to supporting quotes.
**Root Cause**: `handleSnippetTextLoaded` was trying to use `acceptQuote` handler which is designed for replacing quotes, not adding new ones.
**Fix**: 
- Created new `addSupportingQuote` message type
- Added `handleAddSupportingQuote` method in claimReviewProvider
- Updated claimReview.js to send proper message with quote data

### 2. Claim Refresh on Return to Editor
**Problem**: After editing a claim in Claim Review, returning to Editor Mode didn't show the updated claim.
**Root Cause**: No mechanism to refresh sentence display when claims change.
**Fix**:
- Added listener to ClaimsManager's `onDidChange` event
- Created `refreshSentencesDisplay` method
- Added `sentencesUpdated` message handler in editingMode.js

### 3. Data Validation Issues
**Problem**: Undefined/null data was being passed between modes, causing display failures.
**Root Cause**: No validation of data structures before transmission to webviews.
**Fix**: Created `DataValidationService` with methods to:
- Validate claim, sentence, and Q&A pair objects
- Sanitize data for webview transmission
- Validate webview messages

### 4. Mode Context Loss
**Problem**: When switching modes, context about what was being edited was lost.
**Root Cause**: No mechanism to pass context between mode switches.
**Fix**: Created `ModeContextManager` to:
- Store context for each mode (editing, writing, claim review, claim matching)
- Provide getters/setters for mode-specific data
- Emit events when context changes

### 5. Citation Status Not Persisted
**Problem**: Citation status (marked for final output) was lost when switching modes or reloading.
**Root Cause**: Citation status stored in memory-only Maps in each provider.
**Fix**: Created `GlobalCitationStatusManager` to:
- Persist citation status to VS Code memento
- Provide global access across all modes
- Load/save citation status on initialization

## New Services Created

### ModeContextManager
**Location**: `packages/vscode-extension/src/core/modeContextManager.ts`
**Purpose**: Manages context and data passing between modes
**Key Methods**:
- `setEditingModeContext()` / `getEditingModeContext()`
- `setWritingModeContext()` / `getWritingModeContext()`
- `setClaimReviewContext()` / `getClaimReviewContext()`
- `setClaimMatchingContext()` / `getClaimMatchingContext()`

### GlobalCitationStatusManager
**Location**: `packages/vscode-extension/src/core/globalCitationStatusManager.ts`
**Purpose**: Persists citation status across all modes and sessions
**Key Methods**:
- `markForCitation()` / `unmarkForCitation()`
- `isCitedForFinal()`
- `getCitedQuotesForClaim()`
- Automatic persistence to VS Code memento

### DataValidationService
**Location**: `packages/vscode-extension/src/core/dataValidationService.ts`
**Purpose**: Validates and sanitizes data before transmission
**Key Methods**:
- `validateClaim()` / `validateSentence()` / `validateQAPair()`
- `sanitizeClaimForWebview()` / `sanitizeSentenceForWebview()` / `sanitizeQAPairForWebview()`
- `validateWebviewMessage()`

## Updated Providers

### ClaimReviewProvider
**Changes**:
- Added imports for ModeContextManager and DataValidationService
- Updated `loadAndDisplayClaim()` to sanitize data before sending
- Added `handleAddSupportingQuote()` method
- Store context in ModeContextManager on load

### EditingModeProvider
**Changes**:
- Added imports for ModeContextManager and DataValidationService
- Added listener to ClaimsManager's `onDidChange` event
- Updated `loadClaimsForSentences()` to validate data
- Created `refreshSentencesDisplay()` method
- Store context in ModeContextManager

### ClaimMatchingProvider
**Changes**:
- Added imports for ModeContextManager and DataValidationService
- Updated `openForSentence()` to validate and sanitize claims
- Store context in ModeContextManager

### WritingModeProvider
**Changes**:
- Added imports for ModeContextManager and DataValidationService
- Updated `initializeWritingMode()` to validate Q&A pairs
- Sanitize data before sending to webview
- Store context in ModeContextManager

## Data Flow Improvements

### Before
```
Editor Mode → (no context) → Claim Review
Claim Review → (no refresh) → Editor Mode
Writing Mode → (no sync) → Editor Mode
```

### After
```
Editor Mode → (context stored) → Claim Review
Claim Review → (context stored + refresh triggered) → Editor Mode
Writing Mode → (context stored + validation) → Editor Mode
All modes → (global citation status) → All modes
```

## Message Flow Validation

All webview messages now follow this pattern:
1. **Validation**: Data is validated before transmission
2. **Sanitization**: Data is sanitized to remove undefined/null values
3. **Context Storage**: Context is stored in ModeContextManager
4. **Transmission**: Clean, validated data is sent to webview
5. **Reception**: Webview validates message type before processing

## Testing Recommendations

1. **Quote Addition**: Create claim → Search quotes → Add quote → Return to editor → Verify quote appears
2. **Mode Switching**: Edit in one mode → Switch to another → Verify data persists
3. **Citation Status**: Mark quote for citation → Switch modes → Verify status persists
4. **Data Validation**: Attempt to pass invalid data → Verify error handling
5. **Context Preservation**: Switch modes multiple times → Verify context is maintained

## Future Improvements

1. Implement global write locking for manuscript.md to prevent concurrent writes
2. Create bidirectional mapping between sentences and Q&A pairs
3. Add data sync service to reconcile state between modes
4. Implement undo/redo across mode switches
5. Add data migration for backward compatibility
