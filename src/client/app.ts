import { createScrollRange } from './scroll-range.ts';

const explorer = document.querySelector<HTMLDivElement>('#explorer')!;
const scrollPosition = document.querySelector<HTMLInputElement>('#scroll-position')!;
const viewport = document.querySelector<HTMLElement>('#numbers')!;
const track = document.querySelector<HTMLDivElement>('#track')!;
const list = document.querySelector<HTMLOListElement>('#rows')!;
const favoriteToggle = document.querySelector<HTMLButtonElement>('#favorites')!;
const empty = document.querySelector<HTMLElement>('#empty')!;
const statusMessage = document.querySelector<HTMLElement>('#status')!;
const template = document.querySelector<HTMLTemplateElement>('#number-item')!;

const rowHeight = Number.parseFloat(getComputedStyle(list).getPropertyValue('--row-height'));
const halfWindow = 50_000;
const wheelMultiplier = 12;
const storageKey = 'every-number:favorites:v1';

function loadFavorites() {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(values)) {
      return new Set<string>(values.filter((value): value is string =>
        typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)));
    }
  } catch {
    // Storage can be unavailable or contain data from an older session.
  }
  return new Set<string>();
}

const favorites = loadFavorites();
let favoriteValues = [...favorites];
const items: {
  element: HTMLLIElement;
  indexPadding: HTMLElement;
  indexValue: HTMLElement;
  number: HTMLElement;
  copy: HTMLButtonElement;
  favorite: HTMLButtonElement;
}[] = [];
let showingFavorites = false;
let allScrollTop = 0;
let firstInWindow = 0n;
let firstRendered: bigint | undefined;
let frame: number | undefined;
let statusTimeout: number | undefined;

function jumpToIndex(index: bigint) {
  const midpoint = BigInt(halfWindow);
  const row = index < midpoint ? index : midpoint;
  firstInWindow = index - row;
  viewport.scrollTop = Number(row) * rowHeight;
  scheduleRender();
}

function render() {
  frame = undefined;
  let top = viewport.scrollTop;
  const row = Math.floor(top / rowHeight);
  let shift = 0;

  // Rebase the native window without moving the visible numbers.
  if (!showingFavorites) {
    if (row >= 2 * halfWindow - halfWindow / 2) {
      shift = row - halfWindow;
    } else if (row < halfWindow / 2 && firstInWindow > 0n) {
      const back = BigInt(halfWindow - row);
      shift = -Number(firstInWindow < back ? firstInWindow : back);
    }
  }

  if (shift !== 0) {
    firstInWindow += BigInt(shift);
    viewport.scrollTop = top - shift * rowHeight;
    top = viewport.scrollTop;
  }

  const localRow = Math.floor(top / rowHeight);
  const first = (showingFavorites ? 0n : firstInWindow) + BigInt(localRow);
  list.style.transform = `translateY(${localRow * rowHeight}px)`;

  if (first === firstRendered) return;
  if (!showingFavorites) updateScrollPosition(first);

  items.forEach(({ element, indexPadding, indexValue, number, copy, favorite }, index) => {
    const position = first + BigInt(index);
    const value = showingFavorites ? favoriteValues[Number(position)] : String(position);
    element.hidden = value === undefined;
    if (value === undefined) return;

    const saved = favorites.has(value);
    indexPadding.textContent = '0'.repeat(Math.max(0, 37 - value.length));
    indexValue.textContent = value;
    number.textContent = value;
    element.dataset.number = value;
    copy.setAttribute('aria-label', `Copy ${value}`);
    favorite.setAttribute('aria-label', `Favorite ${value}`);
    favorite.setAttribute('aria-pressed', String(saved));
    favorite.title = saved ? 'Remove from favorites' : 'Add to favorites';
  });
  firstRendered = first;
}

function scheduleRender() {
  frame ??= requestAnimationFrame(render);
}

function updateTrack() {
  const height = showingFavorites
    ? favoriteValues.length * rowHeight
    : 2 * halfWindow * rowHeight + viewport.clientHeight;
  track.style.height = `${height}px`;
  empty.hidden = !showingFavorites || favorites.size > 0;
  firstRendered = undefined;
  scheduleRender();
}

function resize() {
  const count = Math.ceil(viewport.clientHeight / rowHeight) + 1;
  while (items.length > count) items.pop()?.element.remove();
  while (items.length < count) {
    const element = template.content.querySelector('li')!.cloneNode(true) as HTMLLIElement;
    items.push({
      element,
      indexPadding: element.querySelector('.index-padding')!,
      indexValue: element.querySelector('.index-value')!,
      number: element.querySelector('.number')!,
      copy: element.querySelector('.copy')!,
      favorite: element.querySelector('.favorite')!,
    });
    list.append(element);
  }
  updateTrack();
}

function announce(message: string) {
  clearTimeout(statusTimeout);
  statusMessage.textContent = message;
  statusTimeout = window.setTimeout(() => { statusMessage.textContent = ''; }, 2_500);
}

favoriteToggle.addEventListener('click', () => {
  if (!showingFavorites) allScrollTop = viewport.scrollTop;
  showingFavorites = !showingFavorites;
  viewport.classList.toggle('favorites-view', showingFavorites);
  scrollPosition.hidden = showingFavorites;
  favoriteToggle.setAttribute('aria-pressed', String(showingFavorites));
  updateTrack();
  viewport.scrollTop = showingFavorites ? 0 : allScrollTop;
});

list.addEventListener('click', async (event) => {
  const button = (event.target as Element).closest('button');
  const value = button?.closest('li')?.dataset.number;
  if (!button || value === undefined) return;

  if (button.classList.contains('copy')) {
    try {
      await navigator.clipboard.writeText(value);
      announce('Copied');
    } catch {
      announce('Could not copy the number');
    }
    return;
  }

  if (favorites.has(value)) favorites.delete(value);
  else favorites.add(value);

  favoriteValues = [...favorites];
  updateTrack();
  try {
    localStorage.setItem(storageKey, JSON.stringify(favoriteValues));
  } catch {
    announce('Could not save favorites in this browser');
  }
});

const updateScrollPosition = createScrollRange(scrollPosition, jumpToIndex);

explorer.addEventListener('wheel', (event) => {
  if (showingFavorites || event.ctrlKey || event.shiftKey || !event.cancelable) return;
  const mode = event.deltaMode;
  if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  event.preventDefault();
  const unit = mode === WheelEvent.DOM_DELTA_LINE ? rowHeight : 1;
  const distance = mode === WheelEvent.DOM_DELTA_PAGE
    ? event.deltaY * viewport.clientHeight
    : event.deltaY * unit * wheelMultiplier;
  viewport.scrollTop += distance;
}, { passive: false });

viewport.addEventListener('scroll', scheduleRender, { passive: true });
viewport.addEventListener('keydown', (event) => {
  if (event.key === 'Home') {
    event.preventDefault();
    if (showingFavorites) viewport.scrollTop = 0;
    else jumpToIndex(0n);
  }
});
new ResizeObserver(resize).observe(viewport);
resize();
