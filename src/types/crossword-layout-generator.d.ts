declare module 'crossword-layout-generator' {
  export type CrosswordLayoutInputWord = {
    clue: string;
    answer: string;
  };

  export type CrosswordLayoutResultWord = {
    clue: string;
    answer: string;
    startx?: number;
    starty?: number;
    position?: number;
    orientation?: string;
  };

  export type CrosswordLayoutResult = {
    rows?: number;
    cols?: number;
    table?: string[][];
    table_string?: string;
    result?: CrosswordLayoutResultWord[];
  };

  export function generateLayout(input: CrosswordLayoutInputWord[]): CrosswordLayoutResult;
}
