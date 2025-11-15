import { chromium, type Browser, type Page } from "playwright";

export interface PlaywrightPageHandle {
  pageId: string;
  url: string;
}

export class PlaywrightAutomation {
  private browserPromise: Promise<Browser> | null = null;
  private pages = new Map<string, Page>();
  private nextPageId = 1;

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium.launch({ headless: true });
    }
    return this.browserPromise;
  }

  private getPageOrThrow(pageId: string): Page {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Unknown pageId: ${pageId}`);
    }
    return page;
  }

  /** Open a new page and navigate to the given URL. */
  async openPage(url: string): Promise<PlaywrightPageHandle> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const pageId = `page-${this.nextPageId++}`;
    this.pages.set(pageId, page);
    return { pageId, url: page.url() };
  }

  /** Navigate an existing pageId to a new URL. */
  async navigate(pageId: string, url: string): Promise<PlaywrightPageHandle> {
    const page = this.getPageOrThrow(pageId);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return { pageId, url: page.url() };
  }

  /** Click a selector on the given page. */
  async click(
    pageId: string,
    selector: string,
    waitForNavigation = false
  ): Promise<{ success: boolean; pageId: string }> {
    const page = this.getPageOrThrow(pageId);

    if (waitForNavigation) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load" }),
        page.click(selector),
      ]);
    } else {
      await page.click(selector);
    }

    return { success: true, pageId };
  }

  /** Type text into an input/textarea using fill(). */
  async type(
    pageId: string,
    selector: string,
    value: string
  ): Promise<{ success: boolean }> {
    const page = this.getPageOrThrow(pageId);
    await page.fill(selector, value);
    return { success: true };
  }

  /** Extract text or HTML from the page for the given selector. */
  async extract(
    pageId: string,
    selector: string,
    format: "text" | "html" = "text"
  ): Promise<{ content: string }> {
    const page = this.getPageOrThrow(pageId);
    const locator = page.locator(selector).first();

    let content: string;
    if (format === "html") {
      content = (await locator.innerHTML().catch(() => "")) ?? "";
    } else {
      content = (await locator.innerText().catch(() => "")) ?? "";
    }

    return { content };
  }

  /** Take a screenshot of the page. */
  async screenshot(
    pageId: string,
    options?: { fullPage?: boolean; path?: string }
  ): Promise<Buffer> {
    const page = this.getPageOrThrow(pageId);
    const buffer = await page.screenshot({
      fullPage: options?.fullPage ?? true,
      path: options?.path,
    });
    return buffer;
  }

  /** Evaluate arbitrary code in the page context. */
  async evaluate<T = unknown>(
    pageId: string,
    fn: (...args: any[]) => T | Promise<T>,
    ...args: any[]
  ): Promise<T> {
    const page = this.getPageOrThrow(pageId);
    const result = await page.evaluate(fn, ...args);
    return result as T;
  }
}
