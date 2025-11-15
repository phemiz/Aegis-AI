export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface FormField {
  fieldId: string;
  name?: string;
  labelText?: string;
  placeholder?: string;
  type: string;
  selector: string;
}

export interface WebAutomation {
  search(query: string, maxResults: number): Promise<WebSearchResult[]>;
  navigate(url: string): Promise<{ pageId: string; url: string }>;
  click(
    pageId: string,
    selector: string,
    waitForNavigation: boolean
  ): Promise<{ success: boolean; pageId: string }>;
  extract(
    pageId: string,
    selector: string,
    format: "text" | "html"
  ): Promise<{ content: string }>;
  screenshot(
    pageId: string,
    options?: { fullPage?: boolean }
  ): Promise<{ imageBase64: string }>;
  findFormFields(pageId: string): Promise<FormField[]>;
  setValue(
    pageId: string,
    selector: string,
    value: string
  ): Promise<{ success: boolean }>;
}
