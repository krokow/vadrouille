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
