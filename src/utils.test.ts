import { expect, test } from 'vitest';
import { str2array } from './utils.js';

test.each([
  ['empty', '', []],
  ['single item', 'foo', ['foo']],
  ['multiple items', 'foo,bar,baz', ['foo', 'bar', 'baz']],
  ['trailing comma', 'a,b,c,', ['a', 'b', 'c']],
])('str2array - %s', (_, input, expected) => {
  expect(str2array(input)).toEqual(expected);
});
