const typeFieldName = '__bst__';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dencode = {
  canEncode: (value: any) => boolean;
  encode: (value: any) => any;
  canDecode: (value: any) => boolean;
  decode: (value: any) => any;
};

const createType = (name: string, value: any) => ({ [typeFieldName]: name, value });
const parseType = (name: string, parse: (value: any) => any) => ({
  canDecode: (value: any) => typeof value === 'object' && value[typeFieldName] === name,
  decode: (value: any) => parse(value.value)
});
/* eslint-enable */

const looksLikeDate = (value: string) => (
  /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(.*Z)/.test(value)
);

/*
  For date objects, JSON.parse gives us a string. So, type information
  about whether the field was originally a date object is lost, and what
  we have is a string that resembles a date. The best we can do is duck-type
  the date from the string when decoding, and let it pass through when encoding.
  This has the downside that if one end actually intended to send a string
  representing a date and not a date object, it will get converted to a date
  object on the other end at runtime, but the typescript compiler will think
  it's a string, invariably leading to runtime errors. This could be fixed by
  manually using the new Date(value) constructor after decoding to force convert
  it to a date on the client before processing, but that's painful.
  Just send dates, people. Don't send strings that look like dates.
*/
const dateType: Dencode = {
  canEncode: () => false,
  encode: value => value,
  canDecode: value => typeof value === 'string' && looksLikeDate(value),
  decode: value => new Date(value)
};

const regexpType: Dencode = {
  canEncode: value => Boolean(value && value.constructor === RegExp),
  encode: value => createType('regexp', value.toString()),
  ...parseType('regexp', value => new RegExp(value))
};

const dencoders: Dencode[] = [dateType, regexpType];

export const encode = (value: unknown) => JSON.stringify(
  value,
  (key, value) => dencoders.find(type => type.canEncode(value))?.encode(value) || value
);

export const decode = (value: string) => JSON.parse(
  value,
  (key, value) => dencoders.find(type => type.canDecode(value))?.decode(value) || value
);
