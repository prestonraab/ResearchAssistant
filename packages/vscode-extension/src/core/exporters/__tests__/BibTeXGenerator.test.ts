import { BibTeXGenerator } from '../BibTeXGenerator';
import type { ZoteroItem } from '../../../services/zoteroApiService';

describe('BibTeXGenerator', () => {
  describe('generateEntry', () => {
    test('should generate BibTeX entry for journal article', () => {
      const item: ZoteroItem = {
        key: 'GNFV76AH',
        title: 'Machine Learning Methods for Cancer Classification',
        itemType: 'journalArticle',
        creators: [
          { firstName: 'Fawaz', lastName: 'Alharbi' },
          { firstName: 'Aleksandar', lastName: 'Vakanski' }
        ],
        date: '2023',
        doi: '10.1234/example',
        abstractNote: 'A comprehensive review of ML methods'
      };

      const entry = BibTeXGenerator.generateEntry(item, 'Alharbi2023');

      expect(entry).toContain('@article{Alharbi2023,');
      expect(entry).toContain('title = {Machine Learning Methods for Cancer Classification}');
      expect(entry).toContain('author = {Alharbi, Fawaz and Vakanski, Aleksandar}');
      expect(entry).toContain('year = {2023}');
      expect(entry).toContain('doi = {10.1234/example}');
    });

    test('should generate BibTeX entry for book', () => {
      const item: ZoteroItem = {
        key: 'BOOK123',
        title: 'Introduction to Machine Learning',
        itemType: 'book',
        creators: [{ name: 'John Smith' }],
        date: '2020',
        url: 'https://example.com'
      };

      const entry = BibTeXGenerator.generateEntry(item, 'Smith2020');

      expect(entry).toContain('@book{Smith2020,');
      expect(entry).toContain('title = {Introduction to Machine Learning}');
      expect(entry).toContain('author = {John Smith}');
      expect(entry).toContain('year = {2020}');
      expect(entry).toContain('url = {https://example.com}');
    });

    test('should escape special BibTeX characters', () => {
      const item: ZoteroItem = {
        key: 'SPECIAL123',
        title: 'Title with $special & characters',
        itemType: 'journalArticle',
        creators: [{ name: 'Author' }],
        date: '2023'
      };

      const entry = BibTeXGenerator.generateEntry(item, 'Special2023');

      expect(entry).toContain('\\$');
      expect(entry).toContain('\\&');
    });

    test('should handle items without optional fields', () => {
      const item: ZoteroItem = {
        key: 'MINIMAL123',
        title: 'Minimal Entry',
        itemType: 'misc',
        creators: []
      };

      const entry = BibTeXGenerator.generateEntry(item, 'Minimal');

      expect(entry).toContain('@misc{Minimal,');
      expect(entry).toContain('title = {Minimal Entry}');
      expect(entry).not.toContain('author');
      expect(entry).not.toContain('year');
    });
  });

  describe('generateBibFile', () => {
    test('should generate complete BibTeX file with multiple entries', () => {
      const items: ZoteroItem[] = [
        {
          key: 'ITEM1',
          title: 'First Paper',
          itemType: 'journalArticle',
          creators: [{ name: 'Author One' }],
          date: '2020'
        },
        {
          key: 'ITEM2',
          title: 'Second Paper',
          itemType: 'book',
          creators: [{ name: 'Author Two' }],
          date: '2021'
        }
      ];

      const citeKeyMap = new Map([
        ['ITEM1', 'AuthorOne2020'],
        ['ITEM2', 'AuthorTwo2021']
      ]);

      const bibContent = BibTeXGenerator.generateBibFile(items, citeKeyMap);

      expect(bibContent).toContain('@article{AuthorOne2020,');
      expect(bibContent).toContain('@book{AuthorTwo2021,');
      expect(bibContent).toContain('First Paper');
      expect(bibContent).toContain('Second Paper');
    });

    test('should separate entries with blank lines', () => {
      const items: ZoteroItem[] = [
        {
          key: 'ITEM1',
          title: 'Paper One',
          itemType: 'misc',
          creators: []
        },
        {
          key: 'ITEM2',
          title: 'Paper Two',
          itemType: 'misc',
          creators: []
        }
      ];

      const citeKeyMap = new Map([
        ['ITEM1', 'One'],
        ['ITEM2', 'Two']
      ]);

      const bibContent = BibTeXGenerator.generateBibFile(items, citeKeyMap);

      expect(bibContent).toContain('}\n\n@');
    });
  });
});
