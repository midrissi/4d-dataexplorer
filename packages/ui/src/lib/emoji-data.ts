export const EMOJI_CATEGORY_IDS = [
  'professional',
  'smileys',
  'people',
  'nature',
  'food',
  'activity',
  'travel',
  'objects',
  'symbols',
  'flags',
] as const

export type EmojiCategoryId = (typeof EMOJI_CATEGORY_IDS)[number]

export type EmojiCategory = {
  id: EmojiCategoryId
  icon: string
  emojis: string[]
}

function splitEmojis(value: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const emoji of value.trim().split(/\s+/)) {
    if (!emoji || seen.has(emoji)) continue
    seen.add(emoji)
    result.push(emoji)
  }
  return result
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'professional',
    icon: '💼',
    emojis: splitEmojis(
      '📁 📂 🗂️ 🗃️ 🗄️ 📦 📇 📄 📃 📑 🧾 📘 📚 📖 📕 📗 📙 📓 📔 📒 🔖 🏷️ 📰 🔐 🔒 🔓 🔏 🔑 🗝️ 🛡️ 🪪 📋 📝 ➕ ✏️ 🖊️ ✒️ 🖋️ 🗑️ ✂️ 📌 📍 📎 🖇️ 🔎 🔍 📊 📈 📉 🧮 🔢 🛰️ 📡 🌐 🔌 💻 🖥️ ⌨️ 💾 💿 🚀 ⚡ 🧠 🤖 🧩 💡 📤 📥 📬 📫 📭 📮 ✉️ 📧 📨 📩 ℹ️ ⚠️ 🚨 ✅ ❌ ✳️ ❇️ 🆕 🆗 💯 ⚙️ 🛠️ 🔧 🧰 🪛 🔩 🧪 🔬 🔗 ⏰ ⏱️ ⏳ ⌛ 📅 📆 🗒️ 🗓️ 👤 👥 🧑‍💼 👨‍💻 👩‍💻 🤝 💼 🏢 🏛️ 🏦 🪧'
    ),
  },
  {
    id: 'smileys',
    icon: '😀',
    emojis: splitEmojis(
      '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫡 🤫 🤥 😶 🫥 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 😵‍💫 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾'
    ),
  },
  {
    id: 'people',
    icon: '👋',
    emojis: splitEmojis(
      '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🫶 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 👧 🧒 👦 👩 🧑 👨 👱 🧔 👵 🧓 👴 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 🧌 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🏊 🚣 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌'
    ),
  },
  {
    id: 'nature',
    icon: '🌿',
    emojis: splitEmojis(
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🪼 🪸 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🐈 🐈‍⬛ 🪶 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🍃 🍂 🍁 🪺 🪹 🍄 🐚 🪨 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 ☔ ☂️ 🌊 🌫️'
    ),
  },
  {
    id: 'food',
    icon: '🍔',
    emojis: splitEmojis(
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🫘 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂'
    ),
  },
  {
    id: 'activity',
    icon: '⚽',
    emojis: splitEmojis(
      '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🎰 🧩 ♟️'
    ),
  },
  {
    id: 'travel',
    icon: '✈️',
    emojis: splitEmojis(
      '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🛞 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🪝 ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🛝 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 ⛩️ 🕋 ⛲ 🛤️ 🛣️ 🗾 🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁'
    ),
  },
  {
    id: 'objects',
    icon: '💡',
    emojis: splitEmojis(
      '⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 💉 🩸 💊 🧬 🦠 🧫 🧪 🧹 🪠 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🫧 🪥 🧽 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎 🏮 🎐 ✉️ 📧 📨 📩 📤 📥 📦 📫 📪 📬 📭 📮 🗳️ ✏️ ✒️ 🖋️ 🖊️ 🖌️ 🖍️ 📝 💼 📁 📂 🗂️ 📄 📃 📑 🧾 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🏷️ 📰 🗞️ 📅 📆 🗒️ 🗓️ 📇 📈 📉 📊 📋 📌 📍 📎 🖇️ 📏 📐 ✂️ 🗃️ 🗄️ 🗑️ 🔒 🔓 🔏 🔐 🔎 🔍 🪧 🪪 🔗 🧷'
    ),
  },
  {
    id: 'symbols',
    icon: '🔣',
    emojis: splitEmojis(
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧️ 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ ♾️ 💲 💱 ™️ ©️ ®️ 👁️‍🗨️ 💬 💭 🗯️ ♠️ ♥️ ♦️ ♣️ 🃏 🎴 🀄 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛'
    ),
  },
  {
    id: 'flags',
    icon: '🏳️',
    emojis: splitEmojis(
      '🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🇺🇳 🇺🇸 🇬🇧 🇫🇷 🇩🇪 🇪🇸 🇮🇹 🇨🇦 🇦🇺 🇯🇵 🇨🇳 🇮🇳 🇧🇷 🇲🇽 🇳🇱 🇧🇪 🇨🇭 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇮🇪 🇵🇹 🇬🇷 🇵🇱 🇺🇦 🇷🇺 🇹🇷 🇸🇦 🇦🇪 🇪🇬 🇿🇦 🇰🇷 🇸🇬 🇳🇿 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇦🇹 🇨🇿 🇭🇺 🇷🇴 🇧🇬 🇭🇷 🇷🇸 🇸🇰 🇸🇮 🇱🇹 🇱🇻 🇪🇪 🇮🇸 🇱🇺 🇲🇹 🇨🇾 🇹🇭 🇻🇳 🇵🇭 🇮🇩 🇲🇾 🇵🇰 🇧🇩 🇳🇬 🇰🇪 🇬🇭 🇲🇦 🇹🇳 🇩🇿 🇮🇱 🇶🇦 🇰🇼'
    ),
  },
]

/** Extra search aliases → emoji (lowercase keys). */
export const EMOJI_SEARCH_ALIASES: Record<string, string[]> = {
  folder: ['📁', '📂', '🗂️'],
  file: ['📄', '📃', '📑', '🧾'],
  book: ['📘', '📚', '📖', '📕', '📗', '📙'],
  lock: ['🔐', '🔒', '🔏'],
  unlock: ['🔓'],
  key: ['🔑', '🗝️'],
  search: ['🔎', '🔍'],
  trash: ['🗑️'],
  delete: ['🗑️', '❌'],
  warning: ['⚠️', '🚨'],
  info: ['ℹ️'],
  settings: ['⚙️', '🛠️'],
  gear: ['⚙️'],
  lightning: ['⚡'],
  puzzle: ['🧩'],
  list: ['📋', '📝'],
  plus: ['➕'],
  minus: ['➖'],
  edit: ['✏️', '🖊️'],
  pencil: ['✏️'],
  box: ['📦', '🗃️'],
  broom: ['🧹'],
  upload: ['📤'],
  download: ['📥'],
  chart: ['📊', '📈', '📉'],
  satellite: ['🛰️'],
  login: ['🔐', '🔑'],
  auth: ['🔐', '🔑', '🛡️'],
  shield: ['🛡️'],
  api: ['🛰️', '🔌', '📡', '🌐'],
  rest: ['🛰️', '🔌', '📁', '🔐', '📋'],
  crud: ['📋', '➕', '✏️', '🗑️', '🔎'],
  catalog: ['📘', '📚', '📁', '🗂️'],
  query: ['🔎', '🔍', '📊'],
  entity: ['📦', '📄', '🪪'],
  dataclass: ['📁', '📂', '📘'],
  session: ['🪪', '👤', '⏰'],
  function: ['🧩', '⚡', '🧠'],
  compute: ['🧮', '📊', '📈'],
  professional: ['💼', '📁', '🔐', '🛰️', '⚙️'],
  star: ['⭐', '🌟'],
  fire: ['🔥'],
  check: ['✅'],
  cross: ['❌'],
  mail: ['✉️', '📧'],
  link: ['🔗'],
  globe: ['🌐', '🌍', '🌎', '🌏'],
  home: ['🏠', '🏡'],
  user: ['👤', '👥'],
  people: ['👥', '👤'],
  time: ['⏰', '⏱️', '⏳'],
  calendar: ['📅', '📆'],
  tag: ['🏷️'],
  bug: ['🐛'],
  rocket: ['🚀'],
  computer: ['💻', '🖥️'],
  phone: ['📱'],
}

export function allEmojis(): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const category of EMOJI_CATEGORIES) {
    for (const emoji of category.emojis) {
      if (!emoji || seen.has(emoji)) continue
      seen.add(emoji)
      result.push(emoji)
    }
  }
  return result
}

export function filterEmojis(query: string, categoryId?: EmojiCategoryId | 'all'): string[] {
  const normalized = query.trim().toLowerCase()
  const base =
    !categoryId || categoryId === 'all'
      ? allEmojis()
      : (EMOJI_CATEGORIES.find((category) => category.id === categoryId)?.emojis ?? [])

  if (!normalized) return base

  const fromAliases = new Set<string>()
  for (const [alias, emojis] of Object.entries(EMOJI_SEARCH_ALIASES)) {
    if (alias.includes(normalized) || normalized.includes(alias)) {
      for (const emoji of emojis) fromAliases.add(emoji)
    }
  }

  return base.filter((emoji) => emoji.includes(normalized) || fromAliases.has(emoji))
}
