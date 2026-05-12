export interface PostcodeResult {
  postcode: string
  lat: number
  lng: number
}

export async function lookupPostcode(postcode: string): Promise<PostcodeResult | null> {
  const clean = postcode.trim().toUpperCase().replace(/\s+/g, '')
  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`)
  if (!res.ok) return null
  const json = await res.json()
  const r = json.result
  return { postcode: r.postcode, lat: r.latitude, lng: r.longitude }
}
