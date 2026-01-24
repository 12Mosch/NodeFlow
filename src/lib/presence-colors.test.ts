import { describe, expect, it } from 'vitest'
import {
  PRESENCE_COLORS,
  getPresenceColor,
  getPresenceColorStyles,
  getRandomPresenceColor,
} from './presence-colors'

describe('presence-colors', () => {
  describe('PRESENCE_COLORS', () => {
    it('should have 15 distinct colors', () => {
      expect(PRESENCE_COLORS).toHaveLength(15)
    })

    it('should have unique colors', () => {
      const uniqueColors = new Set(PRESENCE_COLORS)
      expect(uniqueColors.size).toBe(15)
    })

    it('should be valid hex colors', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/
      for (const color of PRESENCE_COLORS) {
        expect(color).toMatch(hexPattern)
      }
    })
  })

  describe('getPresenceColor', () => {
    it('should return a color from the palette', () => {
      const color = getPresenceColor('test-user-id')
      expect(PRESENCE_COLORS).toContain(color)
    })

    it('should return consistent colors for the same ID', () => {
      const id = 'consistent-user-123'
      const color1 = getPresenceColor(id)
      const color2 = getPresenceColor(id)
      const color3 = getPresenceColor(id)
      expect(color1).toBe(color2)
      expect(color2).toBe(color3)
    })

    it('should return different colors for different IDs', () => {
      // With 15 colors and random distribution, testing multiple pairs
      // should find at least one pair with different colors
      const ids = ['user-1', 'user-2', 'user-3', 'user-4', 'user-5']
      const colors = ids.map(getPresenceColor)
      const uniqueColors = new Set(colors)
      // With 5 different IDs and 15 colors, very unlikely to all get same color
      expect(uniqueColors.size).toBeGreaterThan(1)
    })

    it('should handle empty string', () => {
      const color = getPresenceColor('')
      expect(PRESENCE_COLORS).toContain(color)
    })

    it('should handle special characters', () => {
      const color = getPresenceColor('user@example.com/session#123')
      expect(PRESENCE_COLORS).toContain(color)
    })
  })

  describe('getRandomPresenceColor', () => {
    it('should return a color from the palette', () => {
      const color = getRandomPresenceColor()
      expect(PRESENCE_COLORS).toContain(color)
    })

    it('should return colors with reasonable distribution', () => {
      // Call multiple times and verify we get variety
      const colors = new Set<string>()
      for (let i = 0; i < 100; i++) {
        colors.add(getRandomPresenceColor())
      }
      // Should get at least a few different colors over 100 calls
      expect(colors.size).toBeGreaterThan(3)
    })
  })

  describe('getPresenceColorStyles', () => {
    it('should return valid CSS custom properties', () => {
      const styles = getPresenceColorStyles('#E91E63')
      expect(styles['--presence-color']).toBe('#E91E63')
      expect(styles['--presence-color-light']).toBe('#E91E6333')
    })

    it('should add 33 (20% opacity) suffix for light color', () => {
      const styles = getPresenceColorStyles('#FFFFFF')
      expect(styles['--presence-color-light']).toBe('#FFFFFF33')
    })
  })
})
