import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function inspectVectraIndex() {
  const indexPath = path.join(__dirname, '.cache', 'vectra-index');
  const vectraIndex = new LocalIndex(indexPath);
  
  try {
    console.log('Loading Vectra index from:', indexPath);
    
    const items = await vectraIndex.listItems();
    console.log(`\nTotal items in index: ${items.length}`);
    
    if (items.length > 0) {
      const firstItem = items[0];
      console.log('\n=== First Item ===');
      console.log('ID:', firstItem.id);
      console.log('Metadata keys:', Object.keys(firstItem.metadata));
      console.log('Metadata:', JSON.stringify(firstItem.metadata, null, 2));
      console.log('Vector length:', firstItem.vector.length);
      
      // Check a few more items
      console.log('\n=== Checking first 5 items for text field ===');
      for (let i = 0; i < Math.min(5, items.length); i++) {
        const item = items[i];
        const hasText = 'text' in item.metadata;
        const textType = typeof item.metadata.text;
        const textLength = typeof item.metadata.text === 'string' ? item.metadata.text.length : 0;
        console.log(`Item ${i}: ID=${item.id.substring(0, 50)}... hasText=${hasText} type=${textType} length=${textLength}`);
      }
    } else {
      console.log('No items in index!');
    }
  } catch (error) {
    console.error('Error inspecting index:', error);
  }
}

inspectVectraIndex();
