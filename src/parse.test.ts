import { expect, test } from 'vitest';
import { parse } from './parse.js';

test.each([
  [
    'empty',
    ``,
    {
      command: null,
      params: {},
      error: null,
    },
  ],

  [
    'command - only',
    `.command`,
    {
      command: 'command',
      params: {},
      error: null,
    },
  ],
  [
    'command - only (space)',
    ` .command   \t`,
    {
      command: 'command',
      params: {},
      error: null,
    },
  ],
  [
    'command - only (hyphen, underscore, dollar)',
    `.$comma-nd_`,
    {
      command: '$comma-nd_',
      params: {},
      error: null,
    },
  ],

  [
    'boolean - true',
    `.command key=true`,
    {
      command: 'command',
      params: { key: true },
      error: null,
    },
  ],
  [
    'boolean - false',
    `.command key=false`,
    {
      command: 'command',
      params: { key: false },
      error: null,
    },
  ],

  [
    'key - simple',
    `.command key=true`,
    {
      command: 'command',
      params: { key: true },
      error: null,
    },
  ],
  [
    'key - underscore',
    `.command _key_=null`,
    {
      command: 'command',
      params: { _key_: null },
      error: null,
    },
  ],
  [
    'key - dollar',
    `.command $key$=true`,
    {
      command: 'command',
      params: { $key$: true },
      error: null,
    },
  ],
  [
    'key - hyphen',
    `.command foo-bar=true`,
    {
      command: 'command',
      params: { ['foo-bar']: true },
      error: null,
    },
  ],
  [
    'key - unicode',
    `.command π=true`,
    {
      command: 'command',
      params: { ['π']: true },
      error: null,
    },
  ],
  [
    'key - complex',
    `.command _$foo-bar=true`,
    {
      command: 'command',
      params: { ['_$foo-bar']: true },
      error: null,
    },
  ],

  [
    'string - single quote (empty)',
    `.command key=''`,
    {
      command: 'command',
      params: { key: `` },
      error: null,
    },
  ],
  [
    'string - single quote (value)',
    `.command key='value'`,
    {
      command: 'command',
      params: { key: `value` },
      error: null,
    },
  ],
  [
    'string - single quote (space)',
    `.command key=' foo bar '`,
    {
      command: 'command',
      params: { key: ` foo bar ` },
      error: null,
    },
  ],
  [
    'string - single quote (quote)',
    `.command key='foo"bar'`,
    {
      command: 'command',
      params: { key: `foo"bar` },
      error: null,
    },
  ],
  [
    'string - single quote (escape)',
    `.command key='foo\\'bar'`,
    {
      command: 'command',
      params: { key: `foo'bar` },
      error: null,
    },
  ],

  [
    'string - double quote (empty)',
    `.command key=""`,
    {
      command: 'command',
      params: { key: `` },
      error: null,
    },
  ],
  [
    'string - double quote (value)',
    `.command key="value"`,
    {
      command: 'command',
      params: { key: `value` },
      error: null,
    },
  ],
  [
    'string - double quote (space)',
    `.command key=" foo bar "`,
    {
      command: 'command',
      params: { key: ` foo bar ` },
      error: null,
    },
  ],
  [
    'string - double quote (quote)',
    `.command key="foo'bar"`,
    {
      command: 'command',
      params: { key: `foo'bar` },
      error: null,
    },
  ],
  [
    'string - double quote (escape)',
    `.command key="foo\\"bar"`,
    {
      command: 'command',
      params: { key: `foo"bar` },
      error: null,
    },
  ],

  [
    'number - zero',
    `.command key=0`,
    {
      command: 'command',
      params: { key: 0 },
      error: null,
    },
  ],
  [
    'number - zero (float)',
    `.command key=0.0`,
    {
      command: 'command',
      params: { key: 0 },
      error: null,
    },
  ],
  [
    'number - integer (positive)',
    `.command key=12345`,
    {
      command: 'command',
      params: { key: 12345 },
      error: null,
    },
  ],
  [
    'number - integer (positive sign)',
    `.command key=+12345`,
    {
      command: 'command',
      params: { key: 12345 },
      error: null,
    },
  ],
  [
    'number - integer (negative)',
    `.command key=-12345`,
    {
      command: 'command',
      params: { key: -12345 },
      error: null,
    },
  ],
  [
    'number - float (positive)',
    `.command key=12.34`,
    {
      command: 'command',
      params: { key: 12.34 },
      error: null,
    },
  ],
  [
    'number - float (positive sign)',
    `.command key=+12.34`,
    {
      command: 'command',
      params: { key: +12.34 },
      error: null,
    },
  ],
  [
    'number - float (negative)',
    `.command key=-12.34`,
    {
      command: 'command',
      params: { key: -12.34 },
      error: null,
    },
  ],
  [
    'number - exponent (positive)',
    `.command key=12e+34`,
    {
      command: 'command',
      params: { key: 12e34 },
      error: null,
    },
  ],
  [
    'number - exponent (negative)',
    `.command key=12e-34`,
    {
      command: 'command',
      params: { key: 12e-34 },
      error: null,
    },
  ],
  [
    'number - fraction',
    `.command key=1.`,
    {
      command: 'command',
      params: {
        key: 1,
      },
      error: null,
    },
  ],
  [
    'number - whole',
    `.command key=.1`,
    {
      command: 'command',
      params: { key: 0.1 },
      error: null,
    },
  ],

  [
    'string - non quote (identifier)',
    `.command key=simple`,
    {
      command: 'command',
      params: { key: `simple` },
      error: null,
    },
  ],
  [
    'string - non quote (hyphen)',
    `.command key=foo-bar`,
    {
      command: 'command',
      params: { key: `foo-bar` },
      error: null,
    },
  ],
  [
    'string - non quote (underscore)',
    `.command key=foo_bar`,
    {
      command: 'command',
      params: { key: `foo_bar` },
      error: null,
    },
  ],
  [
    'string - non quote (filename)',
    `.command key=/path/to/file.yaml`,
    {
      command: 'command',
      params: { key: `/path/to/file.yaml` },
      error: null,
    },
  ],
  [
    'string - non quote (dollar)',
    `.command key=$value`,
    {
      command: 'command',
      params: { key: `$value` },
      error: null,
    },
  ],
  [
    'string - non quote (tilde)',
    `.command key=^foo`,
    {
      command: 'command',
      params: { key: `^foo` },
      error: null,
    },
  ],
  [
    'string - non quote (asterisk)',
    `.command key=****`,
    {
      command: 'command',
      params: { key: `****` },
      error: null,
    },
  ],
  [
    'string - non quote (brackets)',
    `.command key=[{}]`,
    {
      command: 'command',
      params: { key: `[{}]` },
      error: null,
    },
  ],
  [
    'string - non quote (tags)',
    `.command key=<body>`,
    {
      command: 'command',
      params: { key: `<body>` },
      error: null,
    },
  ],

  [
    'multiple - base',
    `.command single='single_value',double="double_value", bool=true,   num=100, stringlike=va_lue`,
    {
      command: 'command',
      params: {
        single: 'single_value',
        double: 'double_value',
        bool: true,
        num: 100,
        stringlike: 'va_lue',
      },
      error: null,
    },
  ],
  [
    'multiple - new line',
    `.command key1=true,\nkey2=false`,
    {
      command: 'command',
      params: {
        key1: true,
        key2: false,
      },
      error: null,
    },
  ],
  [
    'multiple - key value space',
    `.command key1\n=\n true,  \n key2=false`,
    {
      command: 'command',
      params: {
        key1: true,
        key2: false,
      },
      error: null,
    },
  ],
])('success - %s', (_, input, expected) => {
  expect(parse(input)).toEqual(expected);
});
