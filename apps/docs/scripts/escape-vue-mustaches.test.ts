import { describe, expect, it } from 'bun:test'
import { escapeVueMustaches } from './escape-vue-mustaches'

describe('escapeVueMustaches', () => {
  it('rewrites backtick templates to v-pre code so braces stay readable', () => {
    expect(escapeVueMustaches('Insert `{{name}}` here')).toBe(
      'Insert <code v-pre>{{name}}</code> here'
    )
  })

  it('rewrites multiple template code spans', () => {
    expect(escapeVueMustaches('(`{{$this.firstName}}`, `{{$this.methodName}}`)')).toBe(
      '(<code v-pre>{{$this.firstName}}</code>, <code v-pre>{{$this.methodName}}</code>)'
    )
  })

  it('leaves ordinary backticks alone', () => {
    expect(escapeVueMustaches('Version `1.4.x` ships')).toBe('Version `1.4.x` ships')
  })

  it('entity-escapes bare mustaches outside code', () => {
    expect(escapeVueMustaches('raw {{templates}} prose')).toBe(
      'raw &#123;&#123;templates&#125;&#125; prose'
    )
  })
})
