import { describe, expect, it } from 'bun:test'
import { emit, eventBus, on } from './eventBus'

describe('lib/eventBus', () => {
  it('emit and on deliver payload to subscriber', () => {
    let received: unknown
    const sub = on('refresh-view', (payload) => {
      received = payload
    })
    emit('refresh-view', { id: '1' })
    expect(received).toEqual({ id: '1' })
    sub.unsubscribe()
  })

  it('on filters by event type', () => {
    let count = 0
    const sub = on('save-entity', () => {
      count += 1
    })
    emit('save-entity')
    emit('delete-entity')
    emit('save-entity')
    expect(count).toBe(2)
    sub.unsubscribe()
  })

  it('eventBus.emit and eventBus.on work', () => {
    let payload: unknown
    const sub = eventBus.on('new-entity', (p) => {
      payload = p
    })
    eventBus.emit('new-entity', { dataclass: 'Employee' })
    expect(payload).toEqual({ dataclass: 'Employee' })
    sub.unsubscribe()
  })

  it('multiple subscribers receive same event', () => {
    const a: unknown[] = []
    const b: unknown[] = []
    const subA = on('edit-entity', (p) => a.push(p))
    const subB = on('edit-entity', (p) => b.push(p))
    emit('edit-entity', { key: '42' })
    expect(a).toEqual([{ key: '42' }])
    expect(b).toEqual([{ key: '42' }])
    subA.unsubscribe()
    subB.unsubscribe()
  })
})
