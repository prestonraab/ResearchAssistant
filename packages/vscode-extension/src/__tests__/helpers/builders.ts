import type { Claim, Quote } from '@research-assistant/core';
import type { ZoteroItem } from '../../mcp/mcpClient';

/**
 * Builder pattern for creating complex test objects
 * Use these when you need to construct objects with many related properties
 */

export class ClaimBuilder {
  private claim: Claim;

  constructor() {
    this.claim = {
      id: 'C_01',
      text: 'Test claim',
      category: 'Method',
      context: '',
      source: 'Test2024',
      sourceId: 1,
      primaryQuote: '',
      supportingQuotes: [],
      sections: [],
      verified: false,
      createdAt: new Date('2024-01-01'),
      modifiedAt: new Date('2024-01-01'),
    };
  }

  withId(id: string): this {
    this.claim.id = id;
    return this;
  }

  withText(text: string): this {
    this.claim.text = text;
    return this;
  }

  withCategory(category: string): this {
    this.claim.category = category;
    return this;
  }

  withSource(source: string, sourceId?: number): this {
    this.claim.source = source;
    if (sourceId !== undefined) {
      this.claim.sourceId = sourceId;
    }
    return this;
  }

  withContext(context: string): this {
    this.claim.context = context;
    return this;
  }

  withPrimaryQuote(quote: string, source?: string): this {
    this.claim.primaryQuote = quote;
    if (source) {
      this.claim.source = source;
    }
    return this;
  }

  withSupportingQuote(quote: string, source?: string): this {
    this.claim.supportingQuotes.push(quote);
    if (source && !this.claim.source) {
      this.claim.source = source;
    }
    return this;
  }

  withSupportingQuotes(quotes: string[]): this {
    this.claim.supportingQuotes = quotes;
    return this;
  }

  withSection(sectionId: string): this {
    if (!this.claim.sections.includes(sectionId)) {
      this.claim.sections.push(sectionId);
    }
    return this;
  }

  withSections(sections: string[]): this {
    this.claim.sections = sections;
    return this;
  }

  verified(): this {
    this.claim.verified = true;
    return this;
  }

  unverified(): this {
    this.claim.verified = false;
    return this;
  }

  build(): Claim {
    return { ...this.claim };
  }
}

export class ZoteroItemBuilder {
  private item: ZoteroItem;

  constructor() {
    this.item = {
      key: 'ABC123',
      title: 'Test Paper',
      creators: [{ firstName: 'John', lastName: 'Smith' }],
      date: '2023',
      itemType: 'journalArticle',
      abstractNote: 'Test abstract',
    };
  }

  withKey(key: string): this {
    this.item.key = key;
    return this;
  }

  withTitle(title: string): this {
    this.item.title = title;
    return this;
  }

  withAuthor(firstName: string, lastName: string): this {
    if (!this.item.creators) {
      this.item.creators = [];
    }
    this.item.creators.push({ firstName, lastName });
    return this;
  }

  withAuthors(authors: Array<{ firstName: string; lastName: string }>): this {
    this.item.creators = authors;
    return this;
  }

  withDate(date: string): this {
    this.item.date = date;
    return this;
  }

  withYear(year: number): this {
    this.item.date = year.toString();
    return this;
  }

  withType(itemType: string): this {
    this.item.itemType = itemType;
    return this;
  }

  withAbstract(abstractNote: string): this {
    this.item.abstractNote = abstractNote;
    return this;
  }

  withDOI(doi: string): this {
    this.item.DOI = doi;
    return this;
  }

  withURL(url: string): this {
    this.item.url = url;
    return this;
  }

  asJournalArticle(): this {
    this.item.itemType = 'journalArticle';
    return this;
  }

  asBook(): this {
    this.item.itemType = 'book';
    return this;
  }

  asConferencePaper(): this {
    this.item.itemType = 'conferencePaper';
    return this;
  }

  build(): ZoteroItem {
    return { ...this.item };
  }
}

/**
 * Convenience functions for common builder patterns
 */

export const aClaim = () => new ClaimBuilder();
export const aZoteroItem = () => new ZoteroItemBuilder();

/**
 * Pre-configured builders for common scenarios
 */

export const aMethodClaim = () => 
  new ClaimBuilder()
    .withCategory('Method')
    .withText('Test method claim');

export const aResultClaim = () => 
  new ClaimBuilder()
    .withCategory('Result')
    .withText('Test result claim');

export const aVerifiedClaim = () => 
  new ClaimBuilder()
    .verified()
    .withPrimaryQuote('Test quote', 'Test2024');

export const aJournalArticle = () => 
  new ZoteroItemBuilder()
    .asJournalArticle();

export const aBookItem = () => 
  new ZoteroItemBuilder()
    .asBook();
