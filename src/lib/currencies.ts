export const CURRENCIES = [
  ['EUR', 'Euro'], ['USD', 'Dollar américain'], ['GBP', 'Livre sterling'], ['CHF', 'Franc suisse'],
  ['CAD', 'Dollar canadien'], ['JPY', 'Yen'], ['AUD', 'Dollar australien'], ['NZD', 'Dollar néo-zélandais'],
  ['SEK', 'Couronne suédoise'], ['NOK', 'Couronne norvégienne'], ['DKK', 'Couronne danoise'], ['ISK', 'Couronne islandaise'],
  ['PLN', 'Zloty'], ['CZK', 'Couronne tchèque'], ['HUF', 'Forint'], ['RON', 'Leu roumain'], ['BGN', 'Lev bulgare'],
  ['TRY', 'Livre turque'], ['MAD', 'Dirham marocain'], ['TND', 'Dinar tunisien'], ['EGP', 'Livre égyptienne'],
  ['ZAR', 'Rand'], ['THB', 'Baht'], ['VND', 'Dong'], ['IDR', 'Roupie indonésienne'], ['MYR', 'Ringgit'],
  ['SGD', 'Dollar de Singapour'], ['HKD', 'Dollar de Hong Kong'], ['CNY', 'Yuan'], ['KRW', 'Won'], ['INR', 'Roupie indienne'],
  ['MXN', 'Peso mexicain'], ['BRL', 'Réal'], ['ARS', 'Peso argentin'], ['CLP', 'Peso chilien'], ['COP', 'Peso colombien'],
  ['PEN', 'Sol'], ['ILS', 'Shekel'], ['AED', 'Dirham des EAU'], ['XOF', 'Franc CFA (BCEAO)'], ['XPF', 'Franc pacifique'],
] as const

export const CURRENCY_CODES: string[] = CURRENCIES.map(([c]) => c)

/** Devise probable d'une destination (pour le convertisseur) */
const BY_COUNTRY: [RegExp, string][] = [
  [/japon|japan|tokyo|kyoto|osaka/i, 'JPY'], [/chine|china|p[ée]kin|shanghai/i, 'CNY'], [/hong ?kong/i, 'HKD'],
  [/[ée]tats-unis|usa|new york|los angeles|miami|san francisco/i, 'USD'], [/canada|montr[ée]al|qu[ée]bec|toronto/i, 'CAD'],
  [/royaume-uni|angleterre|[ée]cosse|londres|london|edinburgh/i, 'GBP'], [/suisse|gen[eè]ve|zurich/i, 'CHF'],
  [/maroc|marrakech|f[eè]s/i, 'MAD'], [/tunisie/i, 'TND'], [/[ée]gypte/i, 'EGP'], [/turquie|istanbul/i, 'TRY'],
  [/tha[iï]lande|bangkok|phuket/i, 'THB'], [/vietnam|hano[iï]|saigon/i, 'VND'], [/indon[ée]sie|bali/i, 'IDR'],
  [/singapour/i, 'SGD'], [/cor[ée]e|s[ée]oul/i, 'KRW'], [/inde\b|india|delhi|mumbai/i, 'INR'], [/mexique|mexico/i, 'MXN'],
  [/br[ée]sil|rio/i, 'BRL'], [/argentine/i, 'ARS'], [/australie|sydney|melbourne/i, 'AUD'], [/nouvelle-z[ée]lande/i, 'NZD'],
  [/su[eè]de|stockholm/i, 'SEK'], [/norv[eè]ge|oslo/i, 'NOK'], [/danemark|copenhague/i, 'DKK'], [/islande|reykjavik/i, 'ISK'],
  [/pologne|cracovie|varsovie/i, 'PLN'], [/tch[eè]que|prague/i, 'CZK'], [/hongrie|budapest/i, 'HUF'],
  [/afrique du sud|le cap/i, 'ZAR'], [/[ée]mirats|duba[iï]/i, 'AED'], [/isra[eë]l/i, 'ILS'], [/s[ée]n[ée]gal|c[oô]te d.ivoire|dakar/i, 'XOF'],
  [/polyn[ée]sie|tahiti|nouvelle-cal[ée]donie/i, 'XPF'],
]
export function guessCurrency(destination: string | null | undefined): string | null {
  if (!destination) return null
  return BY_COUNTRY.find(([re]) => re.test(destination))?.[1] ?? null
}
