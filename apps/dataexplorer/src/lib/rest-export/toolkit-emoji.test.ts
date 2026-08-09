import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_TOOLKIT_EMOJI,
  dataclassFolderName,
  emojiCategoryKeys,
  emojiForKey,
  formatToolkitTitle,
  PLAIN_FOLDERS,
  PLAIN_LABELS,
  patchCustomEmoji,
  patchCustomEmojis,
  toolkitFolders,
  toolkitLabels,
} from './toolkit-emoji'

describe('toolkit emoji', () => {
  it('uses request and category folder emojis by default, not dataclass folders', () => {
    expect(toolkitFolders.auth).toBe('📁 Auth')
    expect(toolkitLabels.login).toBe('🔐 Login (access key)')
    expect(dataclassFolderName('Company')).toBe('Company')
    expect(emojiForKey('folder.dataclass', DEFAULT_TOOLKIT_EMOJI)).toBe('')
  })

  it('can disable every emoji', () => {
    const none = { ...DEFAULT_TOOLKIT_EMOJI, enabled: false }
    expect(formatToolkitTitle(PLAIN_FOLDERS.auth, 'folder.auth', none)).toBe('Auth')
    expect(formatToolkitTitle(PLAIN_LABELS.login, 'request.login', none)).toBe('Login (access key)')
    expect(dataclassFolderName('Company', none)).toBe('Company')
  })

  it('can enable dataclass folder emoji and custom overrides', () => {
    const withDc = { ...DEFAULT_TOOLKIT_EMOJI, dataclassFolderEmoji: true }
    expect(dataclassFolderName('Company', withDc)).toBe('📁 Company')
    expect(
      formatToolkitTitle(PLAIN_LABELS.list, 'request.list', {
        ...DEFAULT_TOOLKIT_EMOJI,
        custom: { 'request.list': '🧾' },
      })
    ).toBe('🧾 List / query')
    expect(
      formatToolkitTitle(PLAIN_FOLDERS.auth, 'folder.auth', {
        ...DEFAULT_TOOLKIT_EMOJI,
        custom: { 'folder.auth': '' },
      })
    ).toBe('Auth')
  })

  it('groups folder and request emojis by category', () => {
    expect(emojiCategoryKeys('folder.auth')).toEqual([
      'folder.auth',
      'folder.catalog',
      'folder.info',
      'folder.datastoreFunctions',
      'folder.singletons',
      'folder.functions',
    ])
    expect(emojiCategoryKeys('request.login')).toEqual([
      'request.login',
      'request.authentify',
      'request.directoryLogin',
    ])
    expect(emojiCategoryKeys('request.list')).toContain('request.create')
    expect(emojiCategoryKeys('request.classFn')).toContain('request.datastoreFn')
  })

  it('can patch every key in a category', () => {
    const custom = patchCustomEmojis(
      {},
      emojiCategoryKeys('folder.auth'),
      '📚',
      DEFAULT_TOOLKIT_EMOJI
    )
    expect(custom['folder.auth']).toBe('📚')
    expect(custom['folder.catalog']).toBe('📚')
    expect(custom['folder.functions']).toBe('📚')
    expect(custom['folder.dataclass']).toBeUndefined()
  })

  it('can clear every key in a category', () => {
    const custom = patchCustomEmojis(
      { 'request.login': '🪪', 'request.authentify': '🪪' },
      emojiCategoryKeys('request.login'),
      '',
      DEFAULT_TOOLKIT_EMOJI
    )
    expect(custom['request.login']).toBe('')
    expect(custom['request.authentify']).toBe('')
    expect(custom['request.directoryLogin']).toBe('')
    expect(emojiForKey('request.login', { ...DEFAULT_TOOLKIT_EMOJI, custom })).toBe('')
    expect(emojiForKey('request.directoryLogin', { ...DEFAULT_TOOLKIT_EMOJI, custom })).toBe('')
  })

  it('drops custom emoji when it matches the active default', () => {
    expect(patchCustomEmoji({}, 'request.login', '🔐', DEFAULT_TOOLKIT_EMOJI)).toEqual({})
    expect(
      patchCustomEmoji({ 'request.login': '🔑' }, 'request.login', '🔐', DEFAULT_TOOLKIT_EMOJI)
    ).toEqual({})
    expect(patchCustomEmoji({}, 'request.login', '🔑', DEFAULT_TOOLKIT_EMOJI)).toEqual({
      'request.login': '🔑',
    })
  })
})
