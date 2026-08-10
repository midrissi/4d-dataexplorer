/**
 * Postman-compatible dynamic variables (`{{$timestamp}}`, `{{$guid}}`, …).
 * @see https://learning.postman.com/docs/tests-and-scripts/write-scripts/variables-list/
 *
 * Values are generated at resolve time. User-defined env vars with the same key win.
 */

export type DynamicEnvVarDef = {
  /** Key including leading `$` (e.g. `$timestamp`). */
  key: string
  /** Short description for completions / help. */
  description: string
  generate: () => string
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
    return bytes
  }
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return bytes
}

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: readonly T[]): T {
  return items[randomIntInclusive(0, items.length - 1)] as T
}

function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = randomBytes(16)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function randomHex(length: number): string {
  return [...randomBytes(Math.ceil(length / 2))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length)
}

function randomAlphaNumeric(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  const bytes = randomBytes(length)
  for (let i = 0; i < length; i++) {
    const index = (bytes[i] ?? 0) % alphabet.length
    out += alphabet[index] ?? '0'
  }
  return out
}

const FIRST_NAMES = [
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Ava',
  'Ethan',
  'Sophia',
  'Mason',
  'Isabella',
  'Logan',
  'Mia',
  'Lucas',
  'Charlotte',
  'James',
  'Amelia',
  'Benjamin',
] as const

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
] as const

const COLORS = [
  'red',
  'green',
  'blue',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
  'magenta',
  'lime',
  'teal',
  'indigo',
  'violet',
  'fuchsia',
  'grey',
  'black',
  'white',
] as const

const ABBREVIATIONS = [
  'SQL',
  'PCI',
  'JSON',
  'HTTP',
  'API',
  'REST',
  'XML',
  'HTML',
  'CSS',
  'JWT',
] as const

const PROTOCOLS = ['http', 'https'] as const

const LOCALES = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'ja', 'zh', 'ko', 'ar', 'ru'] as const

const JOB_TYPES = [
  'Supervisor',
  'Manager',
  'Coordinator',
  'Specialist',
  'Associate',
  'Director',
] as const

const JOB_AREAS = [
  'Mobility',
  'Intranet',
  'Configuration',
  'Accounts',
  'Branding',
  'Interactions',
] as const

const JOB_DESCRIPTORS = ['Forward', 'Corporate', 'Senior', 'Regional', 'Dynamic', 'Lead'] as const

const CITIES = [
  'Springfield',
  'Riverton',
  'Fairview',
  'Madison',
  'Georgetown',
  'Clinton',
  'Franklin',
  'Greenville',
] as const

const STREETS = [
  'Main',
  'Oak',
  'Pine',
  'Maple',
  'Cedar',
  'Elm',
  'Washington',
  'Lake',
  'Hill',
  'Park',
] as const

const STREET_SUFFIXES = ['Street', 'Avenue', 'Road', 'Drive', 'Lane', 'Court', 'Way'] as const

const COUNTRIES = [
  'United States',
  'Canada',
  'France',
  'Germany',
  'Spain',
  'Italy',
  'Japan',
  'Australia',
  'Brazil',
  'India',
] as const

const COUNTRY_CODES = ['US', 'CA', 'FR', 'DE', 'ES', 'IT', 'JP', 'AU', 'BR', 'IN'] as const

const DOMAINS = ['example.com', 'example.org', 'example.net', 'mail.test', 'sample.dev'] as const

const COMPANY_SUFFIXES = ['Inc', 'LLC', 'Group', 'Ltd', 'Corp'] as const

const PRODUCTS = [
  'Towels',
  'Pizza',
  'Pants',
  'Keyboard',
  'Chair',
  'Lamp',
  'Bottle',
  'Gloves',
] as const

const PRODUCT_ADJECTIVES = [
  'Unbranded',
  'Incredible',
  'Tasty',
  'Handmade',
  'Refined',
  'Practical',
] as const

const PRODUCT_MATERIALS = ['Steel', 'Plastic', 'Frozen', 'Cotton', 'Wooden', 'Rubber'] as const

const DEPARTMENTS = ['Tools', 'Movies', 'Electronics', 'Garden', 'Books', 'Toys', 'Sports'] as const

const NOUNS = ['matrix', 'bus', 'bandwidth', 'protocol', 'system', 'network', 'interface'] as const

const VERBS = [
  'parse',
  'quantify',
  'navigate',
  'generate',
  'index',
  'transmit',
  'compress',
] as const

const ADJECTIVES = [
  'auxiliary',
  'multi-byte',
  'back-end',
  'open-source',
  'real-time',
  'secure',
] as const

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY'] as const

const CURRENCY_NAMES = [
  'US Dollar',
  'Euro',
  'Pound Sterling',
  'Yen',
  'Canadian Dollar',
  'Australian Dollar',
] as const

const CURRENCY_SYMBOLS = ['$', '€', '£', '¥'] as const

const TRANSACTION_TYPES = ['invoice', 'payment', 'deposit', 'withdrawal', 'transfer'] as const

const FILE_EXTS = ['png', 'jpg', 'pdf', 'txt', 'json', 'csv', 'xml', 'zip', 'mp4', 'wav'] as const

const MIME_TYPES = [
  'application/json',
  'text/plain',
  'image/png',
  'application/pdf',
  'multipart/form-data',
  'text/html',
] as const

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
] as const

function randomIPv4(): string {
  return Array.from({ length: 4 }, () => randomIntInclusive(0, 255)).join('.')
}

function randomIPv6(): string {
  return Array.from({ length: 8 }, () => randomHex(4)).join(':')
}

function randomMac(): string {
  return Array.from({ length: 6 }, () => randomHex(2)).join(':')
}

function randomPhone(): string {
  const a = String(randomIntInclusive(200, 999))
  const b = String(randomIntInclusive(200, 999))
  const c = String(randomIntInclusive(1000, 9999))
  return `${a}-${b}-${c}`
}

function def(key: string, description: string, generate: () => string): DynamicEnvVarDef {
  return { key, description, generate }
}

/** Built-in Postman-style dynamic variable definitions. */
export const DYNAMIC_ENV_VARS: readonly DynamicEnvVarDef[] = [
  // Common
  def('$guid', 'A uuid-v4 style guid', uuidV4),
  def('$timestamp', 'Current UNIX timestamp in seconds', () =>
    String(Math.floor(Date.now() / 1000))
  ),
  def('$isoTimestamp', 'Current ISO timestamp at zero UTC', () => new Date().toISOString()),
  def('$randomUUID', 'A random 36-character UUID', uuidV4),

  // Text, numbers, colors
  def('$randomAlphaNumeric', 'A random alpha-numeric character', () => randomAlphaNumeric(1)),
  def('$randomBoolean', 'A random boolean value', () => (Math.random() < 0.5 ? 'true' : 'false')),
  def('$randomInt', 'A random integer between 0 and 1000', () =>
    String(randomIntInclusive(0, 1000))
  ),
  def('$randomColor', 'A random color', () => pick(COLORS)),
  def('$randomHexColor', 'A random hex color', () => `#${randomHex(6)}`),
  def('$randomAbbreviation', 'A random abbreviation', () => pick(ABBREVIATIONS)),

  // Internet
  def('$randomIP', 'A random IPv4 address', randomIPv4),
  def('$randomIPV6', 'A random IPv6 address', randomIPv6),
  def('$randomMACAddress', 'A random MAC address', randomMac),
  def('$randomPassword', 'A random 15-character alpha-numeric password', () =>
    randomAlphaNumeric(15)
  ),
  def('$randomLocale', 'A random two-letter language code', () => pick(LOCALES)),
  def('$randomUserAgent', 'A random user agent', () => pick(USER_AGENTS)),
  def('$randomProtocol', 'A random internet protocol', () => pick(PROTOCOLS)),
  def(
    '$randomSemver',
    'A random semantic version number',
    () => `${randomIntInclusive(0, 9)}.${randomIntInclusive(0, 9)}.${randomIntInclusive(0, 9)}`
  ),

  // Names
  def('$randomFirstName', 'A random first name', () => pick(FIRST_NAMES)),
  def('$randomLastName', 'A random last name', () => pick(LAST_NAMES)),
  def(
    '$randomFullName',
    'A random first and last name',
    () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
  ),
  def('$randomNamePrefix', 'A random name prefix', () =>
    pick(['Mr.', 'Ms.', 'Mrs.', 'Dr.'] as const)
  ),
  def('$randomNameSuffix', 'A random name suffix', () =>
    pick(['Jr.', 'Sr.', 'I', 'II', 'III', 'MD'] as const)
  ),

  // Profession
  def('$randomJobArea', 'A random job area', () => pick(JOB_AREAS)),
  def('$randomJobDescriptor', 'A random job descriptor', () => pick(JOB_DESCRIPTORS)),
  def(
    '$randomJobTitle',
    'A random job title',
    () => `${pick(JOB_DESCRIPTORS)} ${pick(JOB_AREAS)} ${pick(JOB_TYPES)}`
  ),
  def('$randomJobType', 'A random job type', () => pick(JOB_TYPES)),

  // Phone / address
  def('$randomPhoneNumber', 'A random ten-digit phone number', randomPhone),
  def(
    '$randomPhoneNumberExt',
    'A random phone number with extension',
    () => `${randomIntInclusive(10, 99)}-${randomPhone()}`
  ),
  def('$randomCity', 'A random city name', () => pick(CITIES)),
  def(
    '$randomStreetName',
    'A random street name',
    () => `${pick(STREETS)} ${pick(STREET_SUFFIXES)}`
  ),
  def(
    '$randomStreetAddress',
    'A random street address',
    () => `${randomIntInclusive(1, 9999)} ${pick(STREETS)} ${pick(STREET_SUFFIXES)}`
  ),
  def('$randomCountry', 'A random country', () => pick(COUNTRIES)),
  def('$randomCountryCode', 'A random two-letter country code', () => pick(COUNTRY_CODES)),
  def('$randomLatitude', 'A random latitude coordinate', () =>
    (Math.random() * 180 - 90).toFixed(4)
  ),
  def('$randomLongitude', 'A random longitude coordinate', () =>
    (Math.random() * 360 - 180).toFixed(4)
  ),

  // Domains / emails
  def(
    '$randomDomainName',
    'A random domain name',
    () => `${pick(FIRST_NAMES).toLowerCase()}.${pick(['com', 'net', 'org', 'io'] as const)}`
  ),
  def('$randomDomainSuffix', 'A random domain suffix', () =>
    pick(['com', 'net', 'org', 'io'] as const)
  ),
  def('$randomDomainWord', 'A random unqualified domain name', () =>
    pick(FIRST_NAMES).toLowerCase()
  ),
  def('$randomEmail', 'A random email address', () => {
    const user = `${pick(FIRST_NAMES).toLowerCase()}${randomIntInclusive(1, 99)}`
    return `${user}@${pick(['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'] as const)}`
  }),
  def('$randomExampleEmail', 'A random email on an example domain', () => {
    const user = `${pick(FIRST_NAMES)}${randomIntInclusive(1, 99)}`
    return `${user}@${pick(DOMAINS)}`
  }),
  def('$randomUserName', 'A random username', () => {
    return `${pick(FIRST_NAMES)}.${pick(LAST_NAMES)}${randomIntInclusive(1, 99)}`
  }),
  def('$randomUrl', 'A random URL', () => `https://${pick(FIRST_NAMES).toLowerCase()}.example.com`),

  // Finance / commerce (common)
  def('$randomBankAccount', 'A random 8-digit bank account number', () =>
    String(randomIntInclusive(10_000_000, 99_999_999))
  ),
  def('$randomCreditCardMask', 'A random masked credit card number', () =>
    String(randomIntInclusive(1000, 9999))
  ),
  def('$randomTransactionType', 'A random transaction type', () => pick(TRANSACTION_TYPES)),
  def('$randomCurrencyCode', 'A random 3-letter currency code', () => pick(CURRENCY_CODES)),
  def('$randomCurrencyName', 'A random currency name', () => pick(CURRENCY_NAMES)),
  def('$randomCurrencySymbol', 'A random currency symbol', () => pick(CURRENCY_SYMBOLS)),
  def('$randomBitcoin', 'A random bitcoin-like address', () => randomAlphaNumeric(26)),
  def('$randomPrice', 'A random price between 0.00 and 1000.00', () =>
    (Math.random() * 1000).toFixed(2)
  ),
  def('$randomProduct', 'A random product', () => pick(PRODUCTS)),
  def('$randomProductAdjective', 'A random product adjective', () => pick(PRODUCT_ADJECTIVES)),
  def('$randomProductMaterial', 'A random product material', () => pick(PRODUCT_MATERIALS)),
  def(
    '$randomProductName',
    'A random product name',
    () => `${pick(PRODUCT_ADJECTIVES)} ${pick(PRODUCT_MATERIALS)} ${pick(PRODUCTS)}`
  ),
  def('$randomDepartment', 'A random commerce category', () => pick(DEPARTMENTS)),

  // Business
  def(
    '$randomCompanyName',
    'A random company name',
    () => `${pick(LAST_NAMES)} ${pick(COMPANY_SUFFIXES)}`
  ),
  def('$randomCompanySuffix', 'A random company suffix', () => pick(COMPANY_SUFFIXES)),

  // Dates
  def('$randomDate', 'A random date (YYYY-MM-DD)', () => {
    const daysAgo = randomIntInclusive(0, 365 * 40)
    return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
  }),
  def('$randomDateFuture', 'A random future datetime', () =>
    new Date(Date.now() + randomIntInclusive(1, 365) * 86_400_000).toString()
  ),
  def('$randomDatePast', 'A random past datetime', () =>
    new Date(Date.now() - randomIntInclusive(1, 365) * 86_400_000).toString()
  ),
  def('$randomDateRecent', 'A random recent datetime', () =>
    new Date(Date.now() - randomIntInclusive(0, 7) * 86_400_000).toString()
  ),
  def('$randomWeekday', 'A random weekday', () => pick(WEEKDAYS)),
  def('$randomMonth', 'A random month', () => pick(MONTHS)),

  // Files
  def(
    '$randomFileName',
    'A random file name',
    () => `${pick(NOUNS)}_${randomHex(4)}.${pick(FILE_EXTS)}`
  ),
  def('$randomFileExt', 'A random file extension', () => pick(FILE_EXTS)),
  def(
    '$randomCommonFileName',
    'A random common file name',
    () => `${pick(NOUNS)}.${pick(FILE_EXTS)}`
  ),
  def('$randomCommonFileExt', 'A random common file extension', () => pick(FILE_EXTS)),
  def('$randomFilePath', 'A random file path', () => `/tmp/${pick(NOUNS)}.${pick(FILE_EXTS)}`),
  def('$randomDirectoryPath', 'A random directory path', () =>
    pick(['/usr/bin', '/tmp', '/var/log', '/home/user'] as const)
  ),
  def('$randomMimeType', 'A random MIME type', () => pick(MIME_TYPES)),

  // Grammar / lorem-ish
  def('$randomNoun', 'A random noun', () => pick(NOUNS)),
  def('$randomVerb', 'A random verb', () => pick(VERBS)),
  def('$randomIngverb', 'A random verb ending in -ing', () => `${pick(VERBS)}ing`),
  def('$randomAdjective', 'A random adjective', () => pick(ADJECTIVES)),
  def('$randomWord', 'A random word', () => pick([...NOUNS, ...VERBS, ...ADJECTIVES])),
  def(
    '$randomWords',
    'Some random words',
    () => `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(VERBS)}`
  ),
  def(
    '$randomPhrase',
    'A random phrase',
    () =>
      `You can't ${pick(VERBS)} the ${pick(NOUNS)} without ${pick(VERBS)}ing the ${pick(ADJECTIVES)} ${pick(NOUNS)}!`
  ),
  def('$randomLoremWord', 'A random lorem word', () =>
    pick(['lorem', 'ipsum', 'dolor', 'sit', 'amet'] as const)
  ),
  def('$randomLoremWords', 'Some random lorem words', () => 'lorem ipsum dolor sit'),
  def(
    '$randomLoremSentence',
    'A random lorem sentence',
    () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
  ),
  def(
    '$randomLoremSlug',
    'A random lorem URL slug',
    () => `${pick(NOUNS)}-${pick(ADJECTIVES)}-${randomHex(3)}`
  ),
]

const DYNAMIC_BY_KEY = new Map(DYNAMIC_ENV_VARS.map((item) => [item.key, item]))

/** True when `key` is a known Postman-style dynamic variable (leading `$`). */
export function isDynamicEnvVar(key: string): boolean {
  return DYNAMIC_BY_KEY.has(key.trim())
}

/** Generate a fresh value for a dynamic variable, or `undefined` if unknown. */
export function resolveDynamicEnvVar(key: string): string | undefined {
  const defn = DYNAMIC_BY_KEY.get(key.trim())
  return defn ? defn.generate() : undefined
}

/** Keys for completions / help (stable order). */
export function listDynamicEnvVarKeys(): string[] {
  return DYNAMIC_ENV_VARS.map((item) => item.key)
}

export function getDynamicEnvVarDescription(key: string): string | undefined {
  return DYNAMIC_BY_KEY.get(key.trim())?.description
}
