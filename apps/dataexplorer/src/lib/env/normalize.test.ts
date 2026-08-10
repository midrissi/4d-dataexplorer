import { describe, expect, it } from 'bun:test'
import {
  createEmptyEnvironment,
  ENVIRONMENT_COLORS,
  ensureEnvironmentColors,
  nextEnvironmentColor,
  nextNewEnvironmentName,
  normalizeEnvironmentsBlock,
} from './normalize'

describe('nextEnvironmentColor', () => {
  it('picks the first unused preset', () => {
    expect(nextEnvironmentColor([])).toBe(ENVIRONMENT_COLORS[0])
    expect(nextEnvironmentColor([ENVIRONMENT_COLORS[0]])).toBe(ENVIRONMENT_COLORS[1])
  })

  it('cycles when every preset is taken', () => {
    expect(nextEnvironmentColor([...ENVIRONMENT_COLORS])).toBe(ENVIRONMENT_COLORS[0])
  })
})

describe('createEmptyEnvironment', () => {
  it('assigns a color automatically', () => {
    const env = createEmptyEnvironment('Dev')
    expect(env.color).toBe(ENVIRONMENT_COLORS[0])
  })

  it('skips colors already in use', () => {
    const env = createEmptyEnvironment('Staging', [ENVIRONMENT_COLORS[0], ENVIRONMENT_COLORS[1]])
    expect(env.color).toBe(ENVIRONMENT_COLORS[2])
  })
})

describe('ensureEnvironmentColors', () => {
  it('fills missing colors without changing existing ones', () => {
    const [a, b] = ensureEnvironmentColors([
      { id: '1', name: 'A', color: ENVIRONMENT_COLORS[3], variables: [] },
      { id: '2', name: 'B', variables: [] },
    ])
    expect(a?.color).toBe(ENVIRONMENT_COLORS[3])
    expect(b?.color).toBe(ENVIRONMENT_COLORS[0])
  })
})

describe('nextNewEnvironmentName', () => {
  it('starts at 1', () => {
    expect(nextNewEnvironmentName([], 'New Environment')).toBe('New Environment 1')
  })

  it('increments past existing numbers', () => {
    expect(
      nextNewEnvironmentName(['New Environment 1', 'New Environment 3'], 'New Environment')
    ).toBe('New Environment 2')
  })

  it('treats bare base name as occupying 1', () => {
    expect(nextNewEnvironmentName(['New Environment'], 'New Environment')).toBe('New Environment 2')
  })
})

describe('normalizeEnvironmentsBlock', () => {
  it('backfills colors for environments without one', () => {
    const block = normalizeEnvironmentsBlock({
      environments: [{ id: 'a', name: 'Prod', variables: [] }],
      activeEnvironmentId: 'a',
    })
    expect(block.environments[0]?.color).toBe(ENVIRONMENT_COLORS[0])
  })
})
