import { describe, expect, it } from 'vitest'
import { orderBetween } from './order'

describe('orderBetween', () => {
  it('liste vide', () => expect(orderBetween(undefined, undefined)).toBe(1000))
  it('en tête', () => expect(orderBetween(undefined, 1000)).toBe(0))
  it('en fin', () => expect(orderBetween(2000, undefined)).toBe(3000))
  it('au milieu', () => expect(orderBetween(1000, 2000)).toBe(1500))
})
