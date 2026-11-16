// input.js — keyboard state with edge detection (pressed this frame).

export class Input {
  constructor() {
    this.keys = {};
    this.pressedKeys = {};
    this.onFirstGesture = null;
    this._gestured = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!this.keys[e.key]) this.pressedKeys[e.key] = true;
      this.keys[e.key] = true;
      this.gesture();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
    window.addEventListener('blur', () => {
      this.keys = {};
    });
    window.addEventListener('pointerdown', () => this.gesture());
  }

  gesture() {
    if (!this._gestured) {
      this._gestured = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  down(...names) {
    return names.some((n) => !!this.keys[n]);
  }

  pressed(...names) {
    return names.some((n) => !!this.pressedKeys[n]);
  }

  get left() { return this.down('ArrowLeft', 'a', 'A'); }
  get right() { return this.down('ArrowRight', 'd', 'D'); }
  get up() { return this.down('ArrowUp', 'w', 'W'); }
  get downKey() { return this.down('ArrowDown', 's', 'S'); }
  get nitro() { return this.down('Shift', ' '); }

  get steer() {
    return (this.left ? -1 : 0) + (this.right ? 1 : 0);
  }

  endFrame() {
    this.pressedKeys = {};
  }
}
