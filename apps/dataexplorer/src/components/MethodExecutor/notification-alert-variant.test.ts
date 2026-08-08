import { describe, expect, it } from 'bun:test'
import { notificationAlertVariant } from './notification-alert-variant'

describe('notificationAlertVariant', () => {
  it('maps warning types', () => {
    expect(notificationAlertVariant('warning')).toBe('warning')
    expect(notificationAlertVariant('WARN')).toBe('warning')
  })

  it('maps error types to destructive', () => {
    expect(notificationAlertVariant('error')).toBe('destructive')
    expect(notificationAlertVariant('danger')).toBe('destructive')
    expect(notificationAlertVariant('destructive')).toBe('destructive')
  })

  it('maps success types', () => {
    expect(notificationAlertVariant('success')).toBe('success')
    expect(notificationAlertVariant('ok')).toBe('success')
  })

  it('defaults unknown or missing types', () => {
    expect(notificationAlertVariant(undefined)).toBe('default')
    expect(notificationAlertVariant('info')).toBe('default')
  })
})
