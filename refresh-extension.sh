#!/bin/bash
set -e

echo "🧹 Cleaning old extension cache..."
rm -rf ~/.kiro/extensions/research-tools.research-assistant-* 2>/dev/null || true
rm -rf ~/.kiro/extensions/research-tools.research-assistant 2>/dev/null || true

echo "🔨 Building extension..."
npm run build --workspace=research-assistant

echo "📦 Packaging extension..."
cd packages/vscode-extension
vsce package --no-dependencies
cd ../..

echo "✅ Done! New .vsix ready at packages/vscode-extension/research-assistant-0.1.0.vsix"
echo "📌 Next: Close Kiro completely, then install the .vsix and reopen"
