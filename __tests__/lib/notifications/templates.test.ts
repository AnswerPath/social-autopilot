import { renderTemplate } from '@/lib/notifications/templates'

describe('Notification Templates', () => {
  describe('renderTemplate', () => {
    it('replaces {{varName}} with value', () => {
      expect(renderTemplate('Hello {{name}}', { name: 'World' })).toBe('Hello World')
    })

    it('replaces multiple variables', () => {
      expect(
        renderTemplate('Post {{postTitle}} needs approval at {{stepName}}', {
          postTitle: 'My Post',
          stepName: 'Review'
        })
      ).toBe('Post My Post needs approval at Review')
    })

    it('uses empty string for missing variables', () => {
      expect(renderTemplate('Hi {{name}}', {})).toBe('Hi ')
    })

    it('handles number values', () => {
      expect(renderTemplate('Count: {{count}}', { count: 42 })).toBe('Count: 42')
    })
  })
})
