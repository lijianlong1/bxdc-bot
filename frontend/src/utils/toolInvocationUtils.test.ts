import { describe, expect, it } from 'vitest'
import {
  extractArgumentsFromToolCallPayload,
  mergeToolArgumentsField,
  parseStreamToolArguments,
} from './toolInvocationUtils'

describe('mergeToolArgumentsField', () => {
  it('keeps previous when incoming is undefined', () => {
    expect(mergeToolArgumentsField({ a: 1 }, undefined)).toEqual({ a: 1 })
  })

  it('overwrites when incoming is defined', () => {
    expect(mergeToolArgumentsField({ a: 1 }, { b: 2 })).toEqual({ b: 2 })
  })

  it('allows explicit null to replace', () => {
    expect(mergeToolArgumentsField({ a: 1 }, null)).toBeNull()
  })
})

describe('parseStreamToolArguments', () => {
  it('parses JSON object strings', () => {
    expect(parseStreamToolArguments('{"x":1}')).toEqual({ x: 1 })
  })

  it('returns undefined for blank string', () => {
    expect(parseStreamToolArguments('  ')).toBeUndefined()
  })
})

describe('extractArgumentsFromToolCallPayload', () => {
  it('reads OpenAI-style function.arguments string', () => {
    const args = extractArgumentsFromToolCallPayload({
      id: 'call_1',
      function: { name: 'foo', arguments: '{"q":"hi"}' },
    })
    expect(args).toEqual({ q: 'hi' })
  })
})
