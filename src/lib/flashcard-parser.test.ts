import { describe, expect, it } from 'vitest'
import { parseFlashcard } from './flashcard-parser'

describe('flashcard-parser', () => {
  describe('Basic Cards', () => {
    describe('>> (forward)', () => {
      it('should parse basic forward card', () => {
        const result = parseFlashcard('front >> back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: 'back',
        })
      })

      it('should handle whitespace around separator', () => {
        const result = parseFlashcard('front  >>  back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: 'back',
        })
      })
    })

    describe('<< (reverse)', () => {
      it('should parse basic reverse card', () => {
        const result = parseFlashcard('front << back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'reverse',
          cardFront: 'front',
          cardBack: 'back',
        })
      })
    })

    describe('<> (bidirectional)', () => {
      it('should parse basic bidirectional card', () => {
        const result = parseFlashcard('front <> back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'bidirectional',
          cardFront: 'front',
          cardBack: 'back',
        })
      })
    })

    describe('== (forward alias)', () => {
      it('should parse == as forward card', () => {
        const result = parseFlashcard('front == back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: 'back',
        })
      })
    })
  })

  describe('Concept Cards', () => {
    describe(':: (bidirectional)', () => {
      it('should parse concept bidirectional card', () => {
        const result = parseFlashcard('term :: definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'bidirectional',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })
    })

    describe(':> (forward)', () => {
      it('should parse concept forward card', () => {
        const result = parseFlashcard('term :> definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'forward',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })
    })

    describe(':< (reverse)', () => {
      it('should parse concept reverse card', () => {
        const result = parseFlashcard('term :< definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'reverse',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })
    })
  })

  describe('Descriptor Cards', () => {
    describe(';; (forward)', () => {
      it('should parse descriptor forward card', () => {
        const result = parseFlashcard('thing ;; description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'forward',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })
    })

    describe(';< (reverse)', () => {
      it('should parse descriptor reverse card', () => {
        const result = parseFlashcard('thing ;< description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'reverse',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })
    })

    describe(';<> (bidirectional)', () => {
      it('should parse descriptor bidirectional card', () => {
        const result = parseFlashcard('thing ;<> description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'bidirectional',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })
    })
  })

  describe('Cloze Cards', () => {
    it('should parse single occlusion', () => {
      const result = parseFlashcard('The {{capital}} of France')
      expect(result).toEqual({
        isCard: true,
        cardType: 'cloze',
        clozeOcclusions: ['capital'],
      })
    })

    it('should parse multiple occlusions', () => {
      const result = parseFlashcard('{{Paris}} is the {{capital}}')
      expect(result).toEqual({
        isCard: true,
        cardType: 'cloze',
        clozeOcclusions: ['Paris', 'capital'],
      })
    })

    it('should trim whitespace in occlusions', () => {
      const result = parseFlashcard('The {{ capital }} is')
      expect(result).toEqual({
        isCard: true,
        cardType: 'cloze',
        clozeOcclusions: ['capital'],
      })
    })

    it('should not return direction field for cloze', () => {
      const result = parseFlashcard('The {{answer}}')
      expect(result.cardDirection).toBeUndefined()
      expect(result.cardFront).toBeUndefined()
      expect(result.cardBack).toBeUndefined()
    })

    it('should parse cloze with multi-line content', () => {
      const result = parseFlashcard('The {{capital}}\nof France\nis {{Paris}}')
      expect(result).toEqual({
        isCard: true,
        cardType: 'cloze',
        clozeOcclusions: ['capital', 'Paris'],
      })
    })

    it('should extract only occlusion content, not surrounding text', () => {
      const result = parseFlashcard(
        'In 1969, {{Neil Armstrong}} walked on the {{Moon}}',
      )
      expect(result.clozeOcclusions).toEqual(['Neil Armstrong', 'Moon'])
      // Note: surrounding text is not stored in the result,
      // it should be retrieved from the original text content
    })
  })

  describe('Multi-line Cards (Triple Markers)', () => {
    describe('Basic multi-line', () => {
      it('should parse >>> as forward', () => {
        const result = parseFlashcard('front >>> back content')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: 'back content',
        })
      })

      it('should parse <<< as reverse', () => {
        const result = parseFlashcard('front <<< back content')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'reverse',
          cardFront: 'front',
          cardBack: 'back content',
        })
      })

      it('should parse <><> as bidirectional', () => {
        const result = parseFlashcard('front <><> back content')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'bidirectional',
          cardFront: 'front',
          cardBack: 'back content',
        })
      })

      it('should parse === as forward', () => {
        const result = parseFlashcard('front === back content')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: 'back content',
        })
      })

      it('should handle actual newlines in back content', () => {
        const result = parseFlashcard('front >>>\nline 1\nline 2')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: 'line 1\nline 2',
        })
      })
    })

    describe('Concept multi-line', () => {
      it('should parse ::: as bidirectional', () => {
        const result = parseFlashcard('term ::: definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'bidirectional',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })

      it('should parse :>> as forward', () => {
        const result = parseFlashcard('term :>> definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'forward',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })

      it('should parse :<< as reverse', () => {
        const result = parseFlashcard('term :<< definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'reverse',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })
    })

    describe('Descriptor multi-line', () => {
      it('should parse ;;; as forward', () => {
        const result = parseFlashcard('thing ;;; description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'forward',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })

      it('should parse ;;<> as bidirectional', () => {
        const result = parseFlashcard('thing ;;<> description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'bidirectional',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })

      it('should parse ;<< as reverse', () => {
        const result = parseFlashcard('thing ;<< description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'reverse',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })
    })
  })

  describe('Disabled Cards (- suffix)', () => {
    describe('Basic disabled', () => {
      it('should parse >>- as disabled', () => {
        const result = parseFlashcard('front >>- back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'disabled',
          cardFront: 'front',
          cardBack: 'back',
        })
      })

      it('should parse <<- as disabled', () => {
        const result = parseFlashcard('front <<- back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'disabled',
          cardFront: 'front',
          cardBack: 'back',
        })
      })

      it('should parse <>- as disabled', () => {
        const result = parseFlashcard('front <>- back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'disabled',
          cardFront: 'front',
          cardBack: 'back',
        })
      })

      it('should parse ==- as disabled', () => {
        const result = parseFlashcard('front ==- back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'disabled',
          cardFront: 'front',
          cardBack: 'back',
        })
      })
    })

    describe('Concept disabled', () => {
      it('should parse ::- as disabled', () => {
        const result = parseFlashcard('term ::- definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'disabled',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })

      it('should parse :>- as disabled', () => {
        const result = parseFlashcard('term :>- definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'disabled',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })

      it('should parse :<- as disabled', () => {
        const result = parseFlashcard('term :<- definition')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'disabled',
          cardFront: 'term',
          cardBack: 'definition',
        })
      })
    })

    describe('Descriptor disabled', () => {
      it('should parse ;;- as disabled (forward)', () => {
        const result = parseFlashcard('thing ;;- description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'disabled',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })

      it('should parse ;<- as disabled (reverse)', () => {
        const result = parseFlashcard('thing ;<- description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'disabled',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })

      it('should parse ;<>- as disabled (bidirectional)', () => {
        const result = parseFlashcard('thing ;<>- description')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'disabled',
          cardFront: 'thing',
          cardBack: 'description',
        })
      })
    })

    describe('Disabled pattern edge cases', () => {
      it('should not treat double dash ::-- as special (matches ::- with - in back)', () => {
        const result = parseFlashcard('term ::-- definition')
        // Double dash is not a special pattern; ::- matches first
        // The extra - becomes part of the back content
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'disabled',
          cardFront: 'term',
          cardBack: '- definition',
        })
      })

      it('should parse >>>- as >>- disabled (extra > in front)', () => {
        const result = parseFlashcard('front >>>- back')
        // >>- pattern matches before >>> is tried
        // The first > becomes part of the front
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'disabled',
          cardFront: 'front >',
          cardBack: 'back',
        })
      })

      it('should parse :::- as ::- disabled (extra : in front)', () => {
        const result = parseFlashcard('term :::- definition')
        // ::- pattern matches before ::: is tried
        // The first : becomes part of the front
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'disabled',
          cardFront: 'term :',
          cardBack: 'definition',
        })
      })

      it('should parse ;;;- as ;;- disabled (extra ; in front)', () => {
        const result = parseFlashcard('thing ;;;- description')
        // ;;- pattern matches before ;;; is tried
        // The first ; becomes part of the front
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'disabled',
          cardFront: 'thing ;',
          cardBack: 'description',
        })
      })

      it('should parse ;;<- as ;<- disabled (extra ; in front)', () => {
        const result = parseFlashcard('thing ;;<- description')
        // ;<- pattern matches; the first ; becomes part of the front
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'disabled',
          cardFront: 'thing ;',
          cardBack: 'description',
        })
      })

      it('should parse ;;<>- as ;<>- disabled (extra ; in front)', () => {
        const result = parseFlashcard('thing ;;<>- description')
        // ;<>- pattern matches; the first ; becomes part of the front
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'disabled',
          cardFront: 'thing ;',
          cardBack: 'description',
        })
      })
    })
  })

  describe('Edge Cases', () => {
    describe('Empty and whitespace input', () => {
      it('should return isCard: false for empty string', () => {
        const result = parseFlashcard('')
        expect(result).toEqual({ isCard: false })
      })

      it('should return isCard: false for whitespace only', () => {
        const result = parseFlashcard('   ')
        expect(result).toEqual({ isCard: false })
      })

      it('should return isCard: false for tabs and newlines only', () => {
        const result = parseFlashcard('\t\n  \t')
        expect(result).toEqual({ isCard: false })
      })
    })

    describe('Leading and trailing whitespace', () => {
      it('should trim leading whitespace', () => {
        const result = parseFlashcard('  front >> back')
        expect(result.cardFront).toBe('front')
      })

      it('should trim trailing whitespace', () => {
        const result = parseFlashcard('front >> back  ')
        expect(result.cardBack).toBe('back')
      })

      it('should trim both leading and trailing whitespace', () => {
        const result = parseFlashcard('  front >> back  ')
        expect(result.cardFront).toBe('front')
        expect(result.cardBack).toBe('back')
      })
    })

    describe('Empty back content', () => {
      it('should return undefined back for empty back with multi-line marker', () => {
        const result = parseFlashcard('front >>>')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'front',
          cardBack: undefined,
        })
      })

      it('should return isCard: false for standard marker without back', () => {
        // Standard patterns require non-empty back ((.+) not (.*))
        const result = parseFlashcard('front >>')
        expect(result).toEqual({ isCard: false })
      })
    })

    describe('Empty front content', () => {
      it('should return isCard: false for empty front', () => {
        const result = parseFlashcard('>> back')
        expect(result).toEqual({ isCard: false })
      })

      it('should return isCard: false for whitespace-only front', () => {
        const result = parseFlashcard('   >> back')
        expect(result).toEqual({ isCard: false })
      })
    })

    describe('Special characters in content', () => {
      it('should handle > in back content', () => {
        const result = parseFlashcard('a >> b > c')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'a',
          cardBack: 'b > c',
        })
      })

      it('should handle < in back content', () => {
        const result = parseFlashcard('a >> b < c')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'a',
          cardBack: 'b < c',
        })
      })

      it('should handle : in content', () => {
        const result = parseFlashcard('time :: 10:30 AM')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'bidirectional',
          cardFront: 'time',
          cardBack: '10:30 AM',
        })
      })

      it('should handle ; in content', () => {
        const result = parseFlashcard('code ;; a; b; c')
        expect(result).toEqual({
          isCard: true,
          cardType: 'descriptor',
          cardDirection: 'forward',
          cardFront: 'code',
          cardBack: 'a; b; c',
        })
      })
    })

    describe('Double separators', () => {
      it('should capture everything after first >> in back', () => {
        const result = parseFlashcard('a >> b >> c')
        expect(result).toEqual({
          isCard: true,
          cardType: 'basic',
          cardDirection: 'forward',
          cardFront: 'a',
          cardBack: 'b >> c',
        })
      })

      it('should capture everything after first :: in back', () => {
        const result = parseFlashcard('a :: b :: c')
        expect(result).toEqual({
          isCard: true,
          cardType: 'concept',
          cardDirection: 'bidirectional',
          cardFront: 'a',
          cardBack: 'b :: c',
        })
      })
    })
  })

  describe('Pattern Precedence', () => {
    describe('Disabled before standard', () => {
      it('should match >>- before >> for disabled', () => {
        const result = parseFlashcard('a >>- b')
        expect(result.cardDirection).toBe('disabled')
      })

      it('should match ::- before :: for disabled', () => {
        const result = parseFlashcard('a ::- b')
        expect(result.cardDirection).toBe('disabled')
      })

      it('should match ;;- before ;; for disabled', () => {
        const result = parseFlashcard('a ;;- b')
        expect(result.cardDirection).toBe('disabled')
      })
    })

    describe('Multi-line before single-line', () => {
      it('should match >>> before >> for multi-line', () => {
        const result = parseFlashcard('a >>> b')
        // Both would work, but >>> should match first (multi-line pattern)
        expect(result.isCard).toBe(true)
        expect(result.cardType).toBe('basic')
        expect(result.cardDirection).toBe('forward')
      })

      it('should match ::: before :: for multi-line', () => {
        const result = parseFlashcard('a ::: b')
        expect(result.isCard).toBe(true)
        expect(result.cardType).toBe('concept')
        expect(result.cardDirection).toBe('bidirectional')
      })

      it('should match ;;; before ;; for multi-line', () => {
        const result = parseFlashcard('a ;;; b')
        expect(result.isCard).toBe(true)
        expect(result.cardType).toBe('descriptor')
        expect(result.cardDirection).toBe('forward')
      })
    })

    describe('Bidirectional before single-direction', () => {
      it('should match <> as bidirectional not two single chars', () => {
        const result = parseFlashcard('a <> b')
        expect(result.cardDirection).toBe('bidirectional')
      })

      it('should match ;<> as bidirectional', () => {
        const result = parseFlashcard('a ;<> b')
        expect(result.cardDirection).toBe('bidirectional')
        expect(result.cardType).toBe('descriptor')
      })
    })

    describe('Cloze has highest priority', () => {
      it('should parse as cloze when {{}} present with >> marker', () => {
        const result = parseFlashcard('{{cloze}} >> back')
        expect(result).toEqual({
          isCard: true,
          cardType: 'cloze',
          clozeOcclusions: ['cloze'],
        })
      })

      it('should parse as cloze when {{}} present with :: marker', () => {
        const result = parseFlashcard('term :: {{answer}}')
        expect(result).toEqual({
          isCard: true,
          cardType: 'cloze',
          clozeOcclusions: ['answer'],
        })
      })

      it('should parse as cloze when {{}} present anywhere', () => {
        const result = parseFlashcard('some {{text}} here')
        expect(result).toEqual({
          isCard: true,
          cardType: 'cloze',
          clozeOcclusions: ['text'],
        })
      })
    })
  })

  describe('Return Value Structure', () => {
    it('should only return isCard field when not a card', () => {
      const result = parseFlashcard('plain text')
      expect(Object.keys(result)).toEqual(['isCard'])
      expect(result.isCard).toBe(false)
    })

    it('should return correct fields for cloze cards', () => {
      const result = parseFlashcard('The {{answer}}')
      const keys = Object.keys(result).sort()
      expect(keys).toEqual(['cardType', 'clozeOcclusions', 'isCard'])
      expect(result.isCard).toBe(true)
      expect(result.cardType).toBe('cloze')
      expect(result.clozeOcclusions).toEqual(['answer'])
      expect(result.cardDirection).toBeUndefined()
      expect(result.cardFront).toBeUndefined()
      expect(result.cardBack).toBeUndefined()
    })

    it('should return correct fields for standard cards', () => {
      const result = parseFlashcard('front >> back')
      const keys = Object.keys(result).sort()
      expect(keys).toEqual([
        'cardBack',
        'cardDirection',
        'cardFront',
        'cardType',
        'isCard',
      ])
      expect(result.isCard).toBe(true)
      expect(result.cardType).toBe('basic')
      expect(result.cardDirection).toBe('forward')
      expect(result.cardFront).toBe('front')
      expect(result.cardBack).toBe('back')
    })

    it('should have undefined cardBack when back is empty string', () => {
      const result = parseFlashcard('front >>>')
      expect(result.cardBack).toBeUndefined()
    })
  })

  describe('Plain Text (non-cards)', () => {
    it('should not match plain text', () => {
      expect(parseFlashcard('just some text').isCard).toBe(false)
    })

    it('should not match single > or <', () => {
      expect(parseFlashcard('a > b').isCard).toBe(false)
      expect(parseFlashcard('a < b').isCard).toBe(false)
    })

    it('should not match single : or ;', () => {
      expect(parseFlashcard('a : b').isCard).toBe(false)
      expect(parseFlashcard('a ; b').isCard).toBe(false)
    })

    it('should not match incomplete cloze syntax', () => {
      expect(parseFlashcard('a {b} c').isCard).toBe(false)
      expect(parseFlashcard('a { {b} } c').isCard).toBe(false)
    })

    it('should not match empty cloze', () => {
      expect(parseFlashcard('a {{}} b').isCard).toBe(false)
    })
  })
})
