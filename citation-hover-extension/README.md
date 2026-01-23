# Citation Hover Extension

Provides hover tooltips for claim citations in your manuscript.

## Features

- Hover over claim IDs (e.g., `C_03`) in markdown files to see:
  - Full claim text
  - Category (Method, Result, Challenge, etc.)
  - Source information
  - Primary quote from the evidence
  - Context/nuance

## Requirements

- VS Code 1.80.0 or higher
- Workspace must contain `01_Knowledge_Base/claims_and_evidence.md`

## Installation

1. Open this folder in VS Code
2. Press F5 to launch Extension Development Host
3. Open your manuscript in the new window
4. Hover over any claim ID (C_XX) to see the tooltip

## Building for Production

```bash
npm install
npm run compile
```

Then package with `vsce package` (requires vsce: `npm install -g @vscode/vsce`)

## Usage

In your markdown files, hover over claim citations like:

```markdown
<!-- Source: C_03 (Soneson2014) -->
```

The extension will detect `C_03` and show the claim details in a hover tooltip.

## File Structure

The extension expects:
- `01_Knowledge_Base/claims_and_evidence.md` - Contains all claims with evidence
- Claims formatted as: `## C_XX: Claim title`

## Development

- `src/extension.ts` - Main extension code
- `package.json` - Extension manifest
- `tsconfig.json` - TypeScript configuration

## License

MIT
