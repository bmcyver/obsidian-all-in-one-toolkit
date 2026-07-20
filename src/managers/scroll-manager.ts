import { Platform, Setting, TextComponent } from 'obsidian';
import type { WorkspaceWindow } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import { BaseManager } from './base';
import { DEFAULT_SETTINGS } from '../settings';

interface AugmentedWheelEvent extends WheelEvent {
  path?: Element[];
  wheelDeltaY?: number;
  wheelDeltaX?: number;
}

export class ScrollManager implements BaseManager {
  plugin: AllInOneToolkitPlugin;
  private windows: Set<Window> = new Set();

  private animationSmoothness = 3;
  private positionY = 0;
  private isMoving = false;
  private target?: Element;
  private scrollDistance = 0;

  constructor(plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
  }

  onload() {
    if (!Platform.isDesktop) {
      return;
    }

    window.addEventListener('wheel', this.scrollListener, { passive: false });
    this.windows.add(window);

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('window-open', this.windowOpenListener),
    );
  }

  onunload() {
    for (const win of this.windows) {
      try {
        win.removeEventListener('wheel', this.scrollListener);
      } catch {
        // ignore
      }
    }
    this.windows.clear();
  }

  private windowOpenListener = (_win: WorkspaceWindow, win: Window) => {
    win.addEventListener('wheel', this.scrollListener, { passive: false });
    this.windows.add(win);

    const handleClose = () => {
      try {
        win.removeEventListener('wheel', this.scrollListener);
        win.removeEventListener('unload', handleClose);
      } catch {
        // ignore
      }
      this.windows.delete(win);
    };
    win.addEventListener('unload', handleClose);
  };

  private scrollListener = (event: AugmentedWheelEvent) => {
    event.preventDefault();

    const path =
      event.path ||
      (event.composedPath && (event.composedPath() as Element[])) ||
      [];

    const speed = this.plugin.settings.scrollSpeed;

    for (const element of path) {
      if (this.isScrollable(element, event)) {
        this.target = element;

        if (this.isTrackPadUsed(event)) {
          this.scrollWithoutAnimation(event, speed);
        } else {
          this.scrollWithAnimation(event, speed);
        }

        break;
      }
    }
  };

  private scrollWithoutAnimation(event: AugmentedWheelEvent, speed: number) {
    if (!this.target) return;
    this.target.scrollBy(event.deltaX * speed, event.deltaY * speed);
  }

  private scrollWithAnimation(event: AugmentedWheelEvent, speed: number) {
    if (!this.target) return;

    if (!this.isMoving) {
      this.positionY = this.target.scrollTop;
    }

    const acceleration = Math.pow(speed, 1.1);

    this.positionY += event.deltaY * acceleration;
    this.scrollDistance = event.deltaY * acceleration;
    this.positionY = Math.max(
      0,
      Math.min(
        this.positionY,
        this.target.scrollHeight - this.target.clientHeight,
      ),
    );

    if (!this.isMoving) {
      this.isMoving = true;
      this.updateScrollAnimation();
    }
  }

  private updateScrollAnimation() {
    if (!this.isMoving || !this.target) {
      return this.stopScrollAnimation();
    }

    const divider = Math.pow(this.animationSmoothness, 1.3);
    const delta = this.positionY - this.target.scrollTop;
    this.target.scrollTop += delta / divider;

    // Boundary at the top
    if (delta < 0 && this.positionY < 0 && this.target.scrollTop === 0) {
      return this.stopScrollAnimation();
    }

    // Boundary at the bottom
    if (
      delta > 0 &&
      this.positionY >
        this.target.scrollHeight -
          this.target.clientHeight / 2 -
          this.scrollDistance
    ) {
      return this.stopScrollAnimation();
    }

    // Stop when movement delta is approaching zero
    if (
      Math.abs(delta) < this.scrollDistance * 0.015 ||
      Math.abs(delta / divider) < 1
    ) {
      return this.stopScrollAnimation();
    }

    window.requestAnimationFrame(this.updateScrollAnimation.bind(this));
  }

  private stopScrollAnimation() {
    this.isMoving = false;
    this.scrollDistance = 0;
    if (this.target) {
      this.positionY = this.target.scrollTop;
      this.target = undefined;
    }
  }

  private isScrollable(element: Element, event: AugmentedWheelEvent) {
    const isHorizontal = event.deltaX !== 0 && event.deltaY === 0;

    return (
      this.isContentOverflowing(element, isHorizontal) &&
      this.hasOverflowStyle(element, isHorizontal)
    );
  }

  private isContentOverflowing(element: Element, horizontal: boolean) {
    const client = horizontal ? element.clientWidth : element.clientHeight;
    const scroll = horizontal ? element.scrollWidth : element.scrollHeight;
    return client < scroll;
  }

  private hasOverflowStyle(element: Element, horizontal: boolean) {
    const style = getComputedStyle(element);
    const overflow = style.getPropertyValue(
      horizontal ? 'overflow-x' : 'overflow-y',
    );
    return /^(scroll|auto)$/.test(overflow);
  }

  private isTrackPadUsed(event: AugmentedWheelEvent) {
    let isTrackPad = false;
    if (event.wheelDeltaY !== undefined) {
      if (event.wheelDeltaY === event.deltaY * -3) {
        isTrackPad = true;
      }
    } else if (event.deltaMode === 0) {
      isTrackPad = true;
    }
    return isTrackPad;
  }

  renderSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName('스크롤 속도').setHeading();

    let scrollSpeedText: TextComponent;
    new Setting(containerEl)
      .setName('마우스 스크롤 속도')
      .setDesc(
        '마우스 휠 스크롤 속도를 조절합니다 (0.05 ~ 2). 기본값은 1입니다.',
      )
      .addExtraButton((button) => {
        button
          .setIcon('reset')
          .setTooltip('기본값 복원')
          .onClick(async () => {
            this.plugin.settings.scrollSpeed = DEFAULT_SETTINGS.scrollSpeed;
            scrollSpeedText.setValue(String(DEFAULT_SETTINGS.scrollSpeed));
            await this.plugin.saveSettings();
          });
      })
      .addText((text) => {
        scrollSpeedText = text;
        text.inputEl.type = 'number';
        text.inputEl.min = '0.05';
        text.inputEl.max = '2';
        text.inputEl.step = '0.05';
        text.setValue(String(this.plugin.settings.scrollSpeed));
        text.onChange(async (value) => {
          let num = parseFloat(value);
          if (isNaN(num)) return;
          num = Math.max(0.05, Math.min(2, num));
          this.plugin.settings.scrollSpeed = num;
          await this.plugin.saveSettings();
        });
      });
  }
}
