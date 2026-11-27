// The maths of dragging a stop up and down its day, kept apart from the gestures so a quick
// script can check it. Positions are in dp from the top of the stop list, and between each two
// rows sits a walk leg `gap` dp tall. 'worklet': the first two run on the UI thread, every frame
// of a drag.

// The top of the row at `index`: the rows before it and a gap after each
export function topOf(heights: readonly number[], index: number, gap: number): number {
  'worklet';
  let top = 0;
  for (let i = 0; i < index; i += 1) top += (heights[i] ?? 0) + gap;
  return top;
}

type DropIndexInput = {
  // The other stops' row heights, in their order (the lifted stop left out)
  heights: readonly number[];
  liftedHeight: number;
  gap: number;
  // The middle of the floating copy, from the top of the list
  center: number;
  // Where the lifted stop would land now (0 = first): its empty slot sits there
  index: number;
};

// Where a lifted stop would land among the others. The empty slot moves down once the floating
// copy's middle passes the middle of the row below it, and up once it passes the middle of the
// row above. Each row's middle is taken where that row is drawn, so a stop held still between
// two rows stays put instead of flicking back and forth.
export function dropIndex({ heights, liftedHeight, gap, center, index }: DropIndexInput): number {
  'worklet';
  let at = Math.min(Math.max(index, 0), heights.length);
  // The row below the slot is drawn one slot (the lifted row and a gap) lower than it would be
  while (
    at < heights.length &&
    center > topOf(heights, at, gap) + liftedHeight + gap + (heights[at] ?? 0) / 2
  ) {
    at += 1;
  }
  while (at > 0 && center < topOf(heights, at - 1, gap) + (heights[at - 1] ?? 0) / 2) {
    at -= 1;
  }
  return at;
}

// Which row is at `y` (0 = first), or -1 on a gap between rows or past the end
export function rowAt(heights: readonly number[], gap: number, y: number): number {
  let top = 0;
  for (const [index, height] of heights.entries()) {
    if (y >= top && y < top + height) return index;
    top += height + gap;
  }
  return -1;
}

// `items` with `item` put in at `index`
export function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}
