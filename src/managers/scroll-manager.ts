import { Platform } from 'obsidian';
import type { WorkspaceWindow } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';

interface AugmentedWheelEvent extends WheelEvent {
  path?: Element[];
  wheelDeltaY?: number;
  wheelDeltaX?: number;
}

export class ScrollManager {
  private plugin: AllInOneToolkitPlugin;

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

    this.plugin.registerDomEvent(window, 'wheel', this.scrollListener, {
      passive: false,
    });

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('window-open', this.windowOpenListener),
    );
  }

  onunload() {
    // Lifecycle cleanup placeholder
  }

  private windowOpenListener = (_win: WorkspaceWindow, win: Window) => {
    this.plugin.registerDomEvent(win, 'wheel', this.scrollListener, {
      passive: false,
    });
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
}
