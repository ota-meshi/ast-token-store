export type SyntaxElement = {
  range: [number, number];
};

export type TokenFilter<E extends SyntaxElement, R extends E = E> =
  | ((tokenOrComment: E) => tokenOrComment is R)
  | ((tokenOrComment: E) => boolean);

export type CursorWithSkipOptionsWithoutFilter =
  | number
  | {
      includeComments?: false;
      filter?: undefined;
      skip?: number;
    };
export type CursorWithSkipOptionsWithFilter<
  Token extends SyntaxElement,
  R extends Token = Token,
> =
  | TokenFilter<Token, R>
  | {
      includeComments?: false;
      filter: TokenFilter<Token, R>;
      skip?: number;
    };
export type CursorWithSkipOptionsWithComment<
  Token extends SyntaxElement,
  Comment extends SyntaxElement,
  R extends Token | Comment = Token | Comment,
> = {
  includeComments: true;
  filter?: TokenFilter<Token | Comment, R>;
  skip?: number;
};

export type CursorWithCountOptionsWithoutFilter =
  | number
  | {
      includeComments?: false;
      filter?: undefined;
      count?: number;
    };

export type CursorWithCountOptionsWithFilter<
  Token extends SyntaxElement,
  R extends Token = Token,
> =
  | TokenFilter<Token, R>
  | {
      includeComments?: false;
      filter: TokenFilter<Token, R>;
      count?: number;
    };
export type CursorWithCountOptionsWithComment<
  Token extends SyntaxElement,
  Comment extends SyntaxElement,
  R extends Token | Comment = Token | Comment,
> = {
  includeComments: true;
  filter?: TokenFilter<Token | Comment, R>;
  count?: number;
};
