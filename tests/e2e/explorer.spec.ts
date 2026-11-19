import { expect, test } from '@playwright/test';

test('recycles rows through forward and backward scroll windows', async ({ page }) => {
  await page.goto('./');
  const viewport = page.getByRole('main');
  const rows = page.getByRole('listitem');
  await expect(rows.first().locator('.number')).toHaveText('0');
  await expect(rows.nth(1).locator('.number')).toHaveText('1');

  const firstNode = await rows.first().elementHandle();
  const initialCount = await rows.count();
  await viewport.evaluate((element) => { element.scrollTop = 90_000 * 24 + 7; });
  await expect(rows.first().locator('.number')).toHaveText('90000');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', '90000');
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(50_000 * 24 + 7);

  await viewport.evaluate((element) => { element.scrollTop = 90_000 * 24; });
  await expect(rows.first().locator('.number')).toHaveText('130000');
  await viewport.evaluate((element) => { element.scrollTop = 10_000 * 24; });
  await expect(rows.first().locator('.number')).toHaveText('90000');
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuetext', '90000');
  expect(await rows.count()).toBe(initialCount);
  expect(await firstNode?.evaluate((element) => element === document.querySelector('li'))).toBe(true);

  await viewport.press('Home');
  await expect(rows.first().locator('.number')).toHaveText('0');
});

test('supports native wheel, keyboard and responsive resizing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Every Number Dot Com' })).toBeVisible();
  const viewport = page.getByRole('main');
  const rows = page.getByRole('listitem');
  await expect(rows.first().locator('.number')).toHaveText('0');
  const count = await rows.count();
  await viewport.hover();
  await page.mouse.wheel(0, 240);
  const first = rows.first().locator('.number');
  await expect.poll(async () => Number(await first.textContent())).toBeGreaterThan(30);
  const afterWheel = Number(await first.textContent());
  await viewport.press('PageDown');
  await expect.poll(async () => Number(await first.textContent())).toBeGreaterThan(afterWheel);
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: size.height + 240 });
  await expect(rows).toHaveCount(count + 10);
  expect(errors).toEqual([]);
});

test('expands repeatedly and returns the thumb without moving the list', async ({ page }) => {
  await page.goto('./');
  const slider = page.getByRole('slider', { name: 'Jump to index' });
  const number = page.getByRole('listitem').first().locator('.number');
  await expect(number).toHaveText('0');
  const bar = (await slider.boundingBox())!;
  const x = bar.x + bar.width / 2;
  const y = bar.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 12, { steps: 3 });
  await page.mouse.up();
  await expect.poll(async () => Number(await number.textContent())).toBeGreaterThan(1_000);

  async function landingAt(exponent: bigint) {
    const base = 10n ** exponent;
    const readNumber = async () => BigInt(await number.textContent() ?? '0');
    await expect.poll(readNumber).toBeGreaterThan(base);
    const landing = await readNumber();
    expect(landing).toBeLessThan(base + 9n * 10n ** (exponent - 3n));
    expect(String(landing).slice(-12)).toMatch(/[1-9].*[1-9]$/);
    return landing;
  }

  await page.mouse.move(x, bar.y + bar.height - 2);
  await page.mouse.down();
  const firstLimit = await landingAt(35n);
  await expect(slider).toHaveValue('32000');
  await page.mouse.up();

  const sampleThumb = async (min: number, max: number) => (
    await page.waitForFunction(({ min, max }) => {
      const step = document.querySelector<HTMLInputElement>('#scroll-position')!.valueAsNumber;
      if (step > min && step < max) {
        return { time: performance.now(), index: document.querySelector('.number')?.textContent };
      }
    }, { min, max })
  ).jsonValue();
  const early = await sampleThumb(30_800, 31_700);
  const later = await sampleThumb(27_500, 29_000);
  if (!early || !later) throw new Error('Missing intermediate thumb positions');
  expect(early.index).toBe(String(firstLimit));
  expect(later.index).toBe(String(firstLimit));
  expect(later.time - early.time).toBeGreaterThan(250);
  await expect(slider).toHaveValue('26880');
  await expect(number).toHaveText(String(firstLimit));
  await expect(page.getByRole('listitem').nth(1).locator('.number')).toHaveText(String(firstLimit + 1n));

  await page.getByRole('main').hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(async () => BigInt(await number.textContent() ?? '0') > firstLimit).toBe(true);

  await slider.press('End');
  await landingAt(41n);
  await expect(slider).toHaveValue('26880');
  await slider.press('End');
  const thirdLimit = await landingAt(47n);
  const next = page.getByRole('listitem').nth(1).locator('.number');
  await expect(next).toHaveText(String(thirdLimit + 1n));
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 360, height: size.height });
  const horizontal = page.locator('#horizontal-scroll');
  await expect.poll(() => horizontal.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0);
  await horizontal.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const viewport = (await horizontal.boundingBox())!;
  const digits = (await next.boundingBox())!;
  expect(digits.x + digits.width).toBeLessThanOrEqual(viewport.x + viewport.width + 1);
  expect(digits.height).toBeLessThan(24);
  await expect(slider).toHaveValue('26880');

  await slider.press('Home');
  await expect(number).toHaveText('0');
});

test('shows index and number in each row, copies the number, and persists favorites', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  const first = page.getByRole('listitem').nth(0);
  const second = page.getByRole('listitem').nth(1);
  await expect(first.locator('.index-value')).toHaveText('0');
  await expect(first.locator('.number')).toHaveText('0');
  await expect(second.locator('.number')).toHaveText('1');
  const left = (await first.locator('.row-index').boundingBox())!;
  const right = (await first.locator('.number').boundingBox())!;
  expect(right.y).toBe(left.y);
  const copy = (await first.getByRole('button', { name: 'Copy 0' }).boundingBox())!;
  const star = (await first.getByRole('button', { name: 'Favorite 0' }).boundingBox())!;
  expect(copy.x).toBeGreaterThan(left.x);
  expect(star.x).toBeGreaterThan(copy.x);
  expect(right.x).toBeGreaterThan(star.x);
  expect((await second.getByRole('button', { name: 'Copy 1' }).boundingBox())!.x).toBe(copy.x);
  expect((await second.getByRole('button', { name: 'Favorite 1' }).boundingBox())!.x).toBe(star.x);
  expect((await second.boundingBox())!.y).toBeGreaterThan(right.y);

  const viewport = page.getByRole('main');
  await viewport.evaluate((element) => { element.scrollTop = 9_000 * 24; });
  const save = page.getByRole('button', { name: 'Favorite 9001', exact: true });
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Copy 9001', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('9001');

  const toggle = page.getByRole('button', { name: 'Favorites', exact: true });
  await toggle.click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(first.locator('.index-value')).toHaveText('9001');
  await expect(first.locator('.number')).toHaveText('9001');
  await toggle.click();
  await expect(first.locator('.number')).toHaveText('9000');

  await page.reload();
  await toggle.click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(first.locator('.index-value')).toHaveText('9001');
  await expect(first.locator('.number')).toHaveText('9001');
  await save.click();
  await expect(page.getByText('No favorites yet.')).toBeVisible();
  await page.reload();
  await toggle.click();
  await expect(page.getByText('No favorites yet.')).toBeVisible();
});

test('serves static assets under the Pages project path', async ({ request }) => {
  const page = await request.get('./');
  expect(page.ok()).toBe(true);
  expect((await request.get('./app.js')).headers()['content-type']).toContain('text/javascript');
  expect((await request.get('./scroll-range.js')).ok()).toBe(true);
  expect((await request.get('./style.css')).ok()).toBe(true);
  expect((await request.get('./does-not-exist')).status()).toBe(404);
});
