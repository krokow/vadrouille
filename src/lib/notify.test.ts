import { describe, expect, it } from 'vitest'
import { describeChange, urlBase64ToUint8Array } from './notify'

describe('notifications', () => {
  it('message lisible', () => {
    expect(describeChange('Camille', 'insert', 'expenses', 'Taxi')).toBe('Camille a ajouté la dépense « Taxi »')
    expect(describeChange('Bob', 'delete', 'unknown')).toBe('Bob a supprimé un élément')
  })
  it('décodage de clé VAPID base64url', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3])
    expect(urlBase64ToUint8Array('_-8').length).toBe(2)
  })
})
