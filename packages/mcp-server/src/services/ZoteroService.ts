import axios, { AxiosInstance } from 'axios';

export interface ZoteroCollection {
  key: string;
  name: string;
  numItems: number;
}

export interface ZoteroCreator {
  firstName?: string;
  lastName: string;
  creatorType?: string;
}

export interface ZoteroItem {
  key: string;
  title: string;
  creators?: ZoteroCreator[];
  date?: string;
  DOI?: string;
  publicationTitle?: string;
}

export class ZoteroService {
  private client: AxiosInstance;
  private apiKey: string;
  private userId: string;

  constructor(apiKey: string, userId: string) {
    this.apiKey = apiKey;
    this.userId = userId;
    
    this.client = axios.create({
      baseURL: 'https://api.zotero.org',
      headers: {
        'Zotero-API-Key': apiKey,
        'Zotero-API-Version': '3',
        'Content-Type': 'application/json'
      }
    });
  }

  async getCollections(): Promise<ZoteroCollection[]> {
    try {
      const response = await this.client.get(`/users/${this.userId}/collections`);
      return response.data.map((coll: any) => ({
        key: coll.key,
        name: coll.data.name,
        numItems: coll.meta.numItems || 0
      }));
    } catch (error) {
      throw new Error(`Failed to get collections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCollectionByName(name: string): Promise<ZoteroCollection | null> {
    const collections = await this.getCollections();
    return collections.find(c => c.name === name) || null;
  }

  async getCollectionItems(collectionKey: string): Promise<ZoteroItem[]> {
    try {
      const response = await this.client.get(`/users/${this.userId}/collections/${collectionKey}/items`);
      return response.data.map((item: any) => ({
        key: item.key,
        title: item.data.title,
        creators: item.data.creators || [],
        date: item.data.date,
        DOI: item.data.DOI,
        publicationTitle: item.data.publicationTitle
      }));
    } catch (error) {
      throw new Error(`Failed to get collection items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async addPaper(
    collectionName: string,
    title: string,
    authors: ZoteroCreator[],
    metadata?: {
      date?: string;
      DOI?: string;
      publicationTitle?: string;
    }
  ): Promise<{ success: boolean; itemKey?: string; error?: string }> {
    try {
      // Get collection key
      const collection = await this.getCollectionByName(collectionName);
      if (!collection) {
        return {
          success: false,
          error: `Collection "${collectionName}" not found`
        };
      }

      // Prepare item data
      const itemData = {
        itemType: 'journalArticle',
        title,
        creators: authors.map(a => ({
          creatorType: a.creatorType || 'author',
          firstName: a.firstName || '',
          lastName: a.lastName
        })),
        collections: [collection.key],
        ...(metadata?.date && { date: metadata.date }),
        ...(metadata?.DOI && { DOI: metadata.DOI }),
        ...(metadata?.publicationTitle && { publicationTitle: metadata.publicationTitle })
      };

      // Create item
      const response = await this.client.post(`/users/${this.userId}/items`, [itemData]);
      
      if (response.data.successful && response.data.successful['0']) {
        return {
          success: true,
          itemKey: response.data.successful['0'].key
        };
      }

      return {
        success: false,
        error: 'Failed to create item'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add paper: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
