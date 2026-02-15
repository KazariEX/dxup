/* eslint-disable object-shorthand */
/* eslint-disable unused-imports/no-unused-vars */

function swap(foo: number, bar: string, baz: boolean, qux: symbol) {}
//                         ^—^(refactor.rewrite.parameter.backward)

/**
 * function call
 */
swap(2, "3", true, Symbol(5));

/**
 * variable assignment
 */
const o1 = swap;
o1(2, "3", true, Symbol(5));

/**
 * property assignment
 */
const o2 = { swap: swap };
o2.swap(2, "3", true, Symbol(5));

/**
 * shorthand property assignment
 */
const o3 = { swap };
o3.swap(2, "3", true, Symbol(5));

/**
 * type query
 */
const o4: typeof swap = (foo, bar, baz, qux) => {};
o4(2, "3", true, Symbol(5));

/**
 * property with type query
 */
const o5: { swap: typeof swap } = {
    swap: (foo, bar, baz, qux) => {},
};
o5.swap(2, "3", true, Symbol(5));
