import * as cheerio from "cheerio";
import type {
  WebAutomation,
  WebSearchResult,
  FormField,
} from "./webAutomation.js";
import { PlaywrightAutomation } from "./automation/playwrightAutomation.js";

export class PlaywrightWebAutomation implements WebAutomation {
  private automation = new PlaywrightAutomation();

  async search(query: string, maxResults: number): Promise<WebSearchResult[]> {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Search request failed with status ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: WebSearchResult[] = [];

    $(".result__body").each((_: number, el: any) => {
      const title = $(el).find(".result__title a.result__a").text().trim();
      const href = $(el).find(".result__title a.result__a").attr("href") ?? "";
      const snippet = $(el).find(".result__snippet").text().trim();
      if (!title || !href) return;
      results.push({
        title,
        url: href,
        snippet,
      });
    });

    return results.slice(0, maxResults);
  }

  async navigate(url: string): Promise<{ pageId: string; url: string }> {
    return this.automation.openPage(url);
  }

  async click(
    pageId: string,
    selector: string,
    waitForNavigation: boolean
  ): Promise<{ success: boolean; pageId: string }> {
    return this.automation.click(pageId, selector, waitForNavigation);
  }

  async extract(
    pageId: string,
    selector: string,
    format: "text" | "html"
  ): Promise<{ content: string }> {
    return this.automation.extract(pageId, selector, format);
  }

  async screenshot(
    pageId: string,
    options?: { fullPage?: boolean }
  ): Promise<{ imageBase64: string }> {
    const buffer = await this.automation.screenshot(pageId, {
      fullPage: options?.fullPage ?? true,
    });
    return { imageBase64: buffer.toString("base64") };
  }

  async findFormFields(pageId: string): Promise<FormField[]> {
    const fields = await this.automation.evaluate<
      {
        fieldId: string;
        name?: string;
        labelText?: string;
        placeholder?: string;
        type: string;
        selector: string;
      }[]
    >(pageId, () => {
      const results: {
        fieldId: string;
        name?: string;
        labelText?: string;
        placeholder?: string;
        type: string;
        selector: string;
      }[] = [];

      const elements = Array.from(
        document.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, textarea, select")
      );

      for (const el of elements) {
        const id = el.id || el.name || "";
        const name = el.getAttribute("name") || undefined;
        const placeholder = el.getAttribute("placeholder") || undefined;
        const type = (el.getAttribute("type") || el.tagName.toLowerCase()).toLowerCase();

        let labelText: string | undefined;
        if (id) {
          const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (label) labelText = label.textContent?.trim() || undefined;
        }
        if (!labelText) {
          const parentLabel = el.closest("label");
          if (parentLabel) labelText = parentLabel.textContent?.trim() || undefined;
        }

        const selectorParts = [] as string[];
        if (id) selectorParts.push(`#${CSS.escape(id)}`);
        if (name) selectorParts.push(`[name="${CSS.escape(name)}"]`);
        const selector = selectorParts.length
          ? `${el.tagName.toLowerCase()}${selectorParts.join("")}`
          : el.tagName.toLowerCase();

        const fieldId = id || selector;

        results.push({
          fieldId,
          name,
          labelText,
          placeholder,
          type,
          selector,
        });
      }

      return results;
    });

    return fields;
  }

  async setValue(
    pageId: string,
    selector: string,
    value: string
  ): Promise<{ success: boolean }> {
    return this.automation.type(pageId, selector, value);
  }
}
      const results: {
        fieldId: string;
        name?: string;
        labelText?: string;
        placeholder?: string;
        type: string;
        selector: string;
      }[] = [];

      const elements = Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          "input, textarea, select"
        )
      );

      for (const el of elements) {
        const id = el.id || el.name || "";
        const name = el.getAttribute("name") || undefined;
        const placeholder = el.getAttribute("placeholder") || undefined;
        const type = (el.getAttribute("type") || el.tagName.toLowerCase()).toLowerCase();

        let labelText: string | undefined;
        if (id) {
          const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (label) labelText = label.textContent?.trim() || undefined;
        }
        if (!labelText) {
          const parentLabel = el.closest("label");
          if (parentLabel) labelText = parentLabel.textContent?.trim() || undefined;
        }

        const selectorParts = [] as string[];
        if (id) selectorParts.push(`#${CSS.escape(id)}`);
        if (name) selectorParts.push(`[name="${CSS.escape(name)}"]`);
        const selector = selectorParts.length
          ? `${el.tagName.toLowerCase()}${selectorParts.join("")}`
          : el.tagName.toLowerCase();

        const fieldId = id || selector;

        results.push({
          fieldId,
          name,
          labelText,
          placeholder,
          type,
          selector,
        });
      }

      return results;
    });

    return fields;
  }

  async setValue(
    pageId: string,
    selector: string,
    value: string
  ): Promise<{ success: boolean }> {
    const page = this.getPageOrThrow(pageId);
    await page.fill(selector, value);
    return { success: true };
  }
}
