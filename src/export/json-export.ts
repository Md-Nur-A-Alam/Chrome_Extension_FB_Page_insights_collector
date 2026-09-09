import { ContentItem } from '../shared/types';

export class JsonExporter {
  static generateJson(items: ContentItem[]): string {
    return JSON.stringify(items, null, 2);
  }

  static download(items: ContentItem[], filename = 'Facebook_Analytics.json'): void {
    const jsonStr = this.generateJson(items);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
