import { describe, expect, it } from 'vitest'
import { verifiedMapForAddress } from './address-map'

describe('verifiedMapForAddress', () => {
  const coordinates = { lat: 58.4108, lon: 15.6214 }

  it('visar bara koordinater som geokodades för den aktuella adressen', () => {
    expect(verifiedMapForAddress({ ...coordinates, q: 'Storgatan 1' }, 'Storgatan 1')).toEqual(coordinates)
    expect(verifiedMapForAddress({ ...coordinates, q: 'Gamla gatan 2' }, 'Storgatan 1')).toBeNull()
  })

  it('failar stängt för äldre koordinater utan adressfingeravtryck', () => {
    expect(verifiedMapForAddress(coordinates, 'Storgatan 1')).toBeNull()
    expect(verifiedMapForAddress({ ...coordinates, q: ' Storgatan   1 ' }, 'storgatan 1')).toEqual(coordinates)
    expect(verifiedMapForAddress({ ...coordinates, q: 'Storgatan 1' }, null)).toBeNull()
  })

  it('nekar ogiltiga koordinater', () => {
    expect(verifiedMapForAddress({ lat: 91, lon: 15, q: 'Storgatan 1' }, 'Storgatan 1')).toBeNull()
    expect(verifiedMapForAddress({ lat: 58, lon: Number.NaN, q: 'Storgatan 1' }, 'Storgatan 1')).toBeNull()
  })
})
