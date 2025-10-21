name: "UI Component Injection"
description: |

## Purpose
Implement elegant UI component injection that seamlessly integrates HLTB data into Steam pages, matching Steam's design language while providing clear, accessible completion time information.

## Core Principles
1. **Context is King**: Include Steam's CSS classes and design patterns
2. **Validation Loops**: Test on multiple Steam themes and layouts
3. **Information Dense**: Use exact Steam styling and DOM positions
4. **Progressive Success**: Basic injection first, then polish
5. **Design Harmony**: Match Steam's visual language perfectly

---

## Goal
Create a beautiful, non-intrusive UI component that displays HLTB data on Steam pages, adapting to Steam's design updates and user preferences.

## Why
- **User Experience**: Information should be immediately visible
- **Visual Consistency**: Must feel native to Steam
- **Accessibility**: Support screen readers and keyboard navigation
- **Performance**: Minimal impact on page rendering

## What Changed from Original PRD
**No Major Changes** - UI injection is independent of data source:
- ✅ Same UI component design
- ✅ Same injection strategy
- ✅ Same Steam page detection
- ℹ️ Data now comes from local JSON database instead of API
- ℹ️ "No data available" message for games not in database

## What
UI injection system providing:
- Responsive component design
- Dark/light theme support
- Loading states
- Error states
- Animation transitions
- Mobile responsive
- Accessibility features
- Position flexibility
- Style isolation
- Update detection

### Success Criteria
- [ ] Renders in < 50ms
- [ ] Matches Steam's design 100%
- [ ] Works on all page layouts
- [ ] Responsive to viewport changes
- [ ] Accessible (WCAG 2.1 AA)
- [ ] No layout shifts
- [ ] Smooth animations
- [ ] Error states clear
- [ ] Works with Steam themes
- [ ] Updates on dynamic changes

## Implementation Blueprint

### Task 1: Component Structure
```typescript
// src/content/components/hltb-display.ts
export class HLTBDisplay {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;

  constructor(private targetElement: Element) {
    this.createComponent();
  }

  private createComponent() {
    // Create container with shadow DOM for style isolation
    this.container = document.createElement('div');
    this.container.className = 'hltb-extension-container';
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Inject styles and HTML
    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="hltb-widget">
        <div class="hltb-header">
          <img src="${chrome.runtime.getURL('icons/hltb-logo.svg')}" alt="HLTB">
          <span class="hltb-title">HowLongToBeat</span>
        </div>
        <div class="hltb-loading">
          <div class="hltb-spinner"></div>
          <span>Loading completion times...</span>
        </div>
      </div>
    `;
  }

  private getStyles(): string {
    return `
      :host {
        all: initial;
        font-family: "Motiva Sans", Arial, sans-serif;
      }

      .hltb-widget {
        background: linear-gradient(to right, #2a475e 0%, #1b2838 100%);
        border-radius: 4px;
        padding: 16px;
        margin: 16px 0;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        color: #c7d5e0;
      }

      .hltb-header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid #1b2838;
      }

      .hltb-header img {
        width: 24px;
        height: 24px;
        margin-right: 8px;
      }

      .hltb-title {
        font-size: 14px;
        font-weight: 500;
        color: #66c0f4;
      }

      .hltb-times {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }

      .hltb-time-box {
        background: rgba(0,0,0,0.2);
        padding: 8px;
        border-radius: 3px;
        text-align: center;
      }

      .hltb-label {
        font-size: 11px;
        color: #8f98a0;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .hltb-hours {
        font-size: 18px;
        font-weight: bold;
        color: #ffffff;
      }

      .hltb-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .hltb-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #66c0f4;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .hltb-error {
        background: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.3);
        padding: 12px;
        border-radius: 3px;
        text-align: center;
      }

      .hltb-no-data {
        text-align: center;
        color: #8f98a0;
        padding: 12px;
      }

      .hltb-link {
        display: block;
        text-align: right;
        margin-top: 8px;
        font-size: 12px;
      }

      .hltb-link a {
        color: #66c0f4;
        text-decoration: none;
      }

      .hltb-link a:hover {
        color: #ffffff;
        text-decoration: underline;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .hltb-times {
          grid-template-columns: 1fr;
        }
      }

      /* Dark theme adjustments */
      @media (prefers-color-scheme: dark) {
        .hltb-widget {
          background: linear-gradient(to right, #1b2838 0%, #0e1621 100%);
        }
      }
    `;
  }

  updateData(data: HLTBData) {
    if (!this.shadowRoot) return;

    const widget = this.shadowRoot.querySelector('.hltb-widget');
    if (!widget) return;

    if (!data || (!data.mainStory && !data.mainExtra && !data.completionist)) {
      widget.innerHTML = this.renderNoData();
      return;
    }

    widget.innerHTML = this.renderData(data);
  }

  private renderData(data: HLTBData): string {
    return `
      <div class="hltb-header">
        <img src="${chrome.runtime.getURL('icons/hltb-logo.svg')}" alt="HLTB">
        <span class="hltb-title">HowLongToBeat</span>
      </div>
      <div class="hltb-times">
        ${this.renderTimeBox('Main Story', data.mainStory)}
        ${this.renderTimeBox('Main + Extras', data.mainExtra)}
        ${this.renderTimeBox('Completionist', data.completionist)}
      </div>
      <div class="hltb-link">
        <a href="https://howlongtobeat.com/game/${data.gameId}" target="_blank">
          View on HowLongToBeat →
        </a>
      </div>
    `;
  }

  private renderTimeBox(label: string, hours: number | null): string {
    if (hours === null) return '';

    return `
      <div class="hltb-time-box">
        <div class="hltb-label">${label}</div>
        <div class="hltb-hours">${hours} Hours</div>
      </div>
    `;
  }

  private renderNoData(): string {
    return `
      <div class="hltb-header">
        <img src="${chrome.runtime.getURL('icons/hltb-logo.svg')}" alt="HLTB">
        <span class="hltb-title">HowLongToBeat</span>
      </div>
      <div class="hltb-no-data">
        No completion time data available for this game
      </div>
    `;
  }

  showError(message: string) {
    if (!this.shadowRoot) return;

    const widget = this.shadowRoot.querySelector('.hltb-widget');
    if (widget) {
      widget.innerHTML = `
        <div class="hltb-error">
          <strong>Error:</strong> ${message}
        </div>
      `;
    }
  }

  inject() {
    if (!this.container) return;

    // Find optimal injection point
    const injectionPoint = this.findInjectionPoint();
    if (injectionPoint) {
      injectionPoint.insertAdjacentElement('afterend', this.container);
      this.observeChanges();
    }
  }

  private findInjectionPoint(): Element | null {
    // Try multiple selectors in priority order
    const selectors = [
      '.game_meta_data',                    // Above purchase area
      '.game_details',                      // In game details
      '.queue_overflow_ctn',                // Above queue section
      '.glance_ctn_responsive_left',        // In at-a-glance section
      '#game_area_purchase'                 // Above purchase options
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  private observeChanges() {
    // Watch for Steam dynamically updating the page
    const observer = new MutationObserver(() => {
      if (!document.body.contains(this.container!)) {
        this.inject();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  destroy() {
    this.container?.remove();
    this.container = null;
    this.shadowRoot = null;
  }
}
```

### Task 2: Injection Manager
```typescript
// src/content/injection-manager.ts
export class InjectionManager {
  private display: HLTBDisplay | null = null;

  async injectHLTBData(gameInfo: GameInfo, hltbData: HLTBData) {
    // Remove any existing display
    this.cleanup();

    // Find target element
    const target = this.findTarget();
    if (!target) {
      console.error('[HLTB] No suitable injection target found');
      return;
    }

    // Create and inject component
    this.display = new HLTBDisplay(target);
    this.display.inject();

    // Update with data
    if (hltbData) {
      this.display.updateData(hltbData);
    }
  }

  private findTarget(): Element | null {
    return document.querySelector('.page_content') ||
           document.querySelector('#game_highlights') ||
           document.body;
  }

  cleanup() {
    this.display?.destroy();
    this.display = null;
  }
}
```

## Validation Checklist
- [ ] Component renders correctly
- [ ] Shadow DOM isolates styles
- [ ] Responsive on mobile
- [ ] Animations smooth
- [ ] No layout shifts
- [ ] Accessibility compliant
- [ ] Theme support working
- [ ] Error states display
- [ ] Loading states work
- [ ] Updates on navigation

---

## Confidence Score: 9/10
High confidence due to:
- Clear Steam DOM structure
- Shadow DOM provides isolation
- Simple injection pattern

Risk: Steam layout changes