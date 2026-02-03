import type { Claim, SourcedQuote } from '@research-assistant/core';
import type { ZoteroItem } from '@research-assistant/core';

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
      primaryQuote: { text: '', source: '', verified: false },
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

  withContext(context: string): this {
    this.claim.context = context;
    return this;
  }

  withPrimaryQuote(quote: string, source?: string): this {
    this.claim.primaryQuote = {
      text: quote,
      source: source || '',
      verified: false
    };
    return this;
  }

  withSupportingQuote(quote: string, source?: string): this {
    this.claim.supportingQuotes.push({
      text: quote,
      source: source || '',
      verified: false
    });
    return this;
  }

  withSupportingQuotes(quotes: Array<string | { text: string; source: string; verified?: boolean }>): this {
    this.claim.supportingQuotes = quotes.map(q => 
      typeof q === 'string' 
        ? { text: q, source: '', verified: false }
        : { text: q.text, source: q.source, verified: q.verified || false }
    );
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

  withSource(source: string): this {
    this.claim.source = source;
    return this;
  }

  withSourceId(sourceId: number): this {
    this.claim.sourceId = sourceId;
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
    this.item.doi = doi;
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
 * Builder for DocumentSection objects used in export tests
 */
export class DocumentSectionBuilder {
  private section: any;

  constructor() {
    this.section = {
      id: 'section-1',
      level: 1,
      title: 'Section Title',
      content: [],
      parent: null,
      children: [],
      lineStart: 0,
      lineEnd: 10,
    };
  }

  withId(id: string): this {
    this.section.id = id;
    return this;
  }

  withLevel(level: number): this {
    this.section.level = level;
    return this;
  }

  withTitle(title: string): this {
    this.section.title = title;
    return this;
  }

  withContent(content: string[]): this {
    this.section.content = content;
    return this;
  }

  withLineRange(start: number, end: number): this {
    this.section.lineStart = start;
    this.section.lineEnd = end;
    return this;
  }

  withParent(parentId: string | null): this {
    this.section.parent = parentId;
    return this;
  }

  withChildren(childIds: string[]): this {
    this.section.children = childIds;
    return this;
  }

  build(): any {
    return { ...this.section };
  }
}

/**
 * Convenience functions for common builder patterns
 */

export const aClaim = () => new ClaimBuilder();
export const aZoteroItem = () => new ZoteroItemBuilder();
export const aDocumentSection = () => new DocumentSectionBuilder();

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

/**
 * Builder for VerificationResult objects
 */
export class VerificationResultBuilder {
  private result: any;

  constructor() {
    this.result = {
      verified: false,
      similarity: 0.5,
      confidence: 0.5,
      nearestMatch: undefined,
      context: undefined
    };
  }

  verified(): this {
    this.result.verified = true;
    this.result.similarity = 1.0;
    this.result.confidence = 1.0;
    return this;
  }

  unverified(): this {
    this.result.verified = false;
    return this;
  }

  withSimilarity(similarity: number): this {
    this.result.similarity = similarity;
    return this;
  }

  withConfidence(confidence: number): this {
    this.result.confidence = confidence;
    return this;
  }

  withNearestMatch(match: string): this {
    this.result.nearestMatch = match;
    return this;
  }

  withContext(context: string): this {
    this.result.context = context;
    return this;
  }

  build(): any {
    return { ...this.result };
  }
}

/**
 * Builder for OutlineSection objects
 */
export class OutlineSectionBuilder {
  private section: any;

  constructor() {
    this.section = {
      id: 'section-1',
      level: 1,
      title: 'Section Title',
      content: [],
      lineStart: 0,
      lineEnd: 10
    };
  }

  withId(id: string): this {
    this.section.id = id;
    return this;
  }

  withLevel(level: number): this {
    this.section.level = level;
    return this;
  }

  withTitle(title: string): this {
    this.section.title = title;
    return this;
  }

  withContent(content: string[]): this {
    this.section.content = content;
    return this;
  }

  withLineRange(start: number, end: number): this {
    this.section.lineStart = start;
    this.section.lineEnd = end;
    return this;
  }

  build(): any {
    return { ...this.section };
  }
}

/**
 * Convenience functions for common builder patterns
 */

export const aVerificationResult = () => new VerificationResultBuilder();
export const anOutlineSection = () => new OutlineSectionBuilder();

/**
 * Pre-configured builders for common scenarios
 */

export const aHighSimilarityResult = () =>
  new VerificationResultBuilder()
    .withSimilarity(0.95)
    .withConfidence(0.95)
    .withNearestMatch('Similar text found');

export const aLowSimilarityResult = () =>
  new VerificationResultBuilder()
    .withSimilarity(0.3)
    .withConfidence(0.3)
    .withNearestMatch('Somewhat related text');

export const aTopLevelSection = () =>
  new OutlineSectionBuilder()
    .withLevel(1)
    .withTitle('Main Section');

export const aSubsection = () =>
  new OutlineSectionBuilder()
    .withLevel(2)
    .withTitle('Subsection');

export const aDeepSubsection = () =>
  new OutlineSectionBuilder()
    .withLevel(3)
    .withTitle('Deep Subsection');
