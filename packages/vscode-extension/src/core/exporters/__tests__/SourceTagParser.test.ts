import { SourceTagParser } from '../SourceTagParser';

describe('SourceTagParser', () => {
  describe('parseSourceTags', () => {
    test('should parse single claim without citation', () => {
      const text = 'Some text [source:: C_01] more text';
      const result = SourceTagParser.parseSourceTags(text);

      expect(result).toHaveLength(1);
      expect(result[0].claimIds).toEqual(['C_01']);
      expect(result[0].citableClaims).toEqual([]);
    });

    test('should parse single claim with AuthorYear citation', () => {
      const text = 'Some text [source:: C_79(Zou 2005)] more text';
      const result = SourceTagParser.parseSourceTags(text);

      expect(result).toHaveLength(1);
      expect(result[0].claimIds).toEqual(['C_79']);
      expect(result[0].citableClaims).toEqual([
        { claimId: 'C_79', authorYear: 'Zou 2005' }
      ]);
    });

    test('should parse multiple claims with mixed citations', () => {
      const text = '[source:: C_79(Zou 2005), C_80]';
      const result = SourceTagParser.parseSourceTags(text);

      expect(result).toHaveLength(1);
      expect(result[0].claimIds).toEqual(['C_79', 'C_80']);
      expect(result[0].citableClaims).toEqual([
        { claimId: 'C_79', authorYear: 'Zou 2005' }
      ]);
    });

    test('should parse multiple AuthorYear citations', () => {
      const text = '[source:: C_84(Díaz-Uriarte 2006), C_83]';
      const result = SourceTagParser.parseSourceTags(text);

      expect(result).toHaveLength(1);
      expect(result[0].claimIds).toEqual(['C_84', 'C_83']);
      expect(result[0].citableClaims).toEqual([
        { claimId: 'C_84', authorYear: 'Díaz-Uriarte 2006' }
      ]);
    });

    test('should handle claim IDs with letter suffixes', () => {
      const text = '[source:: C_75a(Author 2020)]';
      const result = SourceTagParser.parseSourceTags(text);

      expect(result[0].claimIds).toEqual(['C_75a']);
      expect(result[0].citableClaims).toEqual([
        { claimId: 'C_75a', authorYear: 'Author 2020' }
      ]);
    });

    test('should parse multiple source tags in text', () => {
      const text = `
        First paragraph [source:: C_01(Smith 2020)]
        Second paragraph [source:: C_02, C_03(Jones 2021)]
      `;
      const result = SourceTagParser.parseSourceTags(text);

      expect(result).toHaveLength(2);
      expect(result[0].citableClaims).toEqual([
        { claimId: 'C_01', authorYear: 'Smith 2020' }
      ]);
      expect(result[1].citableClaims).toEqual([
        { claimId: 'C_03', authorYear: 'Jones 2021' }
      ]);
    });
  });

  describe('extractCitationsForExport', () => {
    test('should extract citations with positions', () => {
      const text = 'Text [source:: C_01(Author 2020)] more';
      const result = SourceTagParser.extractCitationsForExport(text);

      expect(result).toHaveLength(1);
      expect(result[0].authorYears).toEqual(['Author 2020']);
      expect(result[0].tagToRemove).toBe('[source:: C_01(Author 2020)]');
    });

    test('should mark tags without citations for removal', () => {
      const text = 'Text [source:: C_01, C_02] more';
      const result = SourceTagParser.extractCitationsForExport(text);

      expect(result).toHaveLength(1);
      expect(result[0].authorYears).toEqual([]);
      expect(result[0].tagToRemove).toBe('[source:: C_01, C_02]');
    });
  });

  describe('convertSourceTagsToCitations', () => {
    test('should convert single citation to formatted output', () => {
      const text = 'Some claim [source:: C_79(Zou 2005)]';
      const result = SourceTagParser.convertSourceTagsToCitations(
        text,
        (authorYears) => `[@${authorYears[0].replace(/\s+/g, '')}]`
      );

      expect(result).toBe('Some claim [@Zou2005]');
    });

    test('should convert multiple citations', () => {
      const text = 'Claim [source:: C_86(Hanczar 2022), C_87, C_88]';
      const result = SourceTagParser.convertSourceTagsToCitations(
        text,
        (authorYears) => authorYears.length > 0 
          ? `[@${authorYears.map(a => a.replace(/\s+/g, '')).join('; @')}]`
          : ''
      );

      expect(result).toBe('Claim [@Hanczar2022]');
    });

    test('should remove tags without citable claims', () => {
      const text = 'Some text [source:: C_01, C_02] continues';
      const result = SourceTagParser.convertSourceTagsToCitations(
        text,
        () => ''
      );

      expect(result).toBe('Some text  continues');
    });

    test('should handle multiple tags in sequence', () => {
      const text = 'First [source:: C_01(A 2020)] second [source:: C_02(B 2021)]';
      const result = SourceTagParser.convertSourceTagsToCitations(
        text,
        (authorYears) => `[@${authorYears[0].replace(/\s+/g, '')}]`
      );

      expect(result).toBe('First [@A2020] second [@B2021]');
    });
  });

  describe('getAllAuthorYears', () => {
    test('should collect all unique AuthorYears', () => {
      const text = `
        [source:: C_01(Smith 2020)]
        [source:: C_02(Jones 2021), C_03]
        [source:: C_04(Smith 2020)]
      `;
      const result = SourceTagParser.getAllAuthorYears(text);

      expect(result.size).toBe(2);
      expect(result.has('Smith 2020')).toBe(true);
      expect(result.has('Jones 2021')).toBe(true);
    });

    test('should return empty set for text without citations', () => {
      const text = '[source:: C_01, C_02]';
      const result = SourceTagParser.getAllAuthorYears(text);

      expect(result.size).toBe(0);
    });
  });
});
