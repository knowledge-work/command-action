import { unicodeIdContinueReg, unicodeIdStartReg } from './unicode-regex.js';

/** @see https://github.com/GregRos/parjs/issues/59 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports */
const { anyCharOf, string, stringLen, noCharOf, anyStringOf, regexp, float, whitespace, eof } =
  require('parjs') as typeof import('parjs');
const { map, qthen, or, many, between, then, thenq, manySepBy, stringify } =
  require('parjs/combinators') as typeof import('parjs/combinators');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports */

// String
const escapes: Record<string, string> = {
  '"': `"`,
  "'": `'`,
  '\\': '\\',
  '/': '/',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

const pEscapeChar = anyCharOf(Object.getOwnPropertyNames(escapes).join()).pipe(map((char) => escapes[char] as string));

const pEscapeUnicode = string('u').pipe(
  qthen(
    stringLen(4).pipe(
      map((str) => parseInt(str, 16)),
      map((x) => String.fromCharCode(x)),
    ),
  ),
);

const pEscapeAny = string('\\').pipe(qthen(pEscapeChar.pipe(or(pEscapeUnicode))));

const pDoubleStr = pEscapeAny.pipe(or(noCharOf('"'))).pipe(many(), stringify(), between('"'));
const pSingleStr = pEscapeAny.pipe(or(noCharOf("'"))).pipe(many(), stringify(), between("'"));
const pStr = pDoubleStr.pipe(or(pSingleStr));

// Identifier
const pIdentSpecial = anyStringOf('$', '_');
const pIdentStart = pIdentSpecial.pipe(or(regexp(unicodeIdStartReg)));
const pIdentContinue = pIdentSpecial.pipe(or(string('-'), regexp(unicodeIdContinueReg)));
const pIdent = pIdentStart.pipe(then(pIdentContinue.pipe(many(), stringify()))).pipe(stringify());

// String-Like
const pStrLikeSpecial = anyStringOf('-', '/', '.', '*', '[', ']', '<', '>', '{', '}', '^');
const pStrLikeStart = pEscapeAny.pipe(or(pStrLikeSpecial, pIdentStart));
const pStrLikeContinue = pEscapeAny.pipe(or(pStrLikeSpecial, pIdentContinue));
const pStrLike = pStrLikeStart.pipe(then(pStrLikeContinue.pipe(many(), stringify()))).pipe(stringify());

// Number
const pNum = float().pipe(map((n) => Number(n)));

// Boolean
const pBool = anyStringOf('true', 'false').pipe(map((s) => s === 'true'));

// Null
const pNull = string('null').pipe(map(() => null));

// Value
const pValue = pStr.pipe(or(pBool, pNull, pNum, pStrLike));

// Key
const pKey = pIdent;

// Pair
const pPair = pKey
  .pipe(thenq(string('=').pipe(between(whitespace()))), then(pValue))
  .pipe(between(whitespace()))
  .pipe(map((v) => ({ [v[0]]: v[1] })));

// Params
const pParams = pPair.pipe(manySepBy(',')).pipe(map((pair) => Object.assign({}, ...pair)));

// Command
const pCommand = string('.').pipe(qthen(pIdent)).pipe(between(whitespace()));

// Program
const pProgram = pCommand.pipe(then(pParams.pipe(or(eof())))).pipe(map((v) => ({ command: v[0], params: v[1] })));

// Main Parser
export type Params = Record<string, string | number | boolean | null>;
export type ParseResult =
  | {
      command: string;
      params: Params;
      error: null;
    }
  | {
      command: null;
      params: Params;
      error: null;
    }
  | {
      command: null;
      params: null;
      error: string;
    };

export const parse = (input: string): ParseResult => {
  const _input = input.trim();
  if (_input === '') {
    return {
      command: null,
      params: {},
      error: null,
    };
  }

  const result = pProgram.parse(_input);
  if (!result.isOk) {
    return {
      command: null,
      params: null,
      error: result.toString(),
    };
  }

  return {
    error: null,
    ...result.value,
  };
};
