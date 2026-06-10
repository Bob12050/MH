(() => {
  'use strict';

  window.BH = window.BH || {};

  const KEY_ACTIONS = new Map([
    [' ', 'attack'],
    ['j', 'attack'],
    ['J', 'attack'],
    ['Shift', 'roll'],
    ['l', 'roll'],
    ['L', 'roll'],
    ['e', 'potion'],
    ['E', 'potion'],
    ['i', 'potion'],
    ['I', 'potion'],
    ['k', 'lock'],
    ['K', 'lock'],
    ['q', 'lock'],
    ['Q', 'lock'],
  ]);

  const KEY_DIRECTIONS = new Map([
    ['ArrowUp', 'up'],
    ['w', 'up'],
    ['W', 'up'],
    ['ArrowDown', 'down'],
    ['s', 'down'],
    ['S', 'down'],
    ['ArrowLeft', 'left'],
    ['a', 'left'],
    ['A', 'left'],
    ['ArrowRight', 'right'],
    ['d', 'right'],
    ['D', 'right'],
  ]);

  BH.Input = class Input {
    constructor() {
      this.actionsDown = new Set();
      this.actionsPressed = new Set();
      this.directions = new Set();
      this.stickVector = { x: 0, y: 0 };
      this.stickPointerId = null;
      this.gestureRollDir = null;
      this.bindKeyboard();
      this.bindTouchButtons();
      this.bindVirtualStick();
      this.bindGestures();
    }

    // Returns the flick direction for a roll if a gesture set one, else the stick/keys axis.
    takeRollAxis() {
      if (this.gestureRollDir) {
        const dir = this.gestureRollDir;
        this.gestureRollDir = null;
        return dir;
      }
      return this.axis();
    }

    // Tap = attack, flick = roll (in flick direction), long-press = potion.
    bindGestures() {
      const canvas = document.getElementById('gameCanvas');
      if (!canvas) return;
      const TAP_SLOP = 16;     // px: movement under this still counts as a tap
      const FLICK_MIN = 30;    // px: movement over this counts as a flick
      const TAP_TIME = 260;    // ms: tap must be quicker than this
      const LONGPRESS = 340;   // ms: hold beyond this (without moving) = potion
      let g = null;

      canvas.addEventListener('pointerdown', (event) => {
        if (g) return;
        g = { id: event.pointerId, sx: event.clientX, sy: event.clientY, t: performance.now(), moved: 0, handled: false };
        g.longTimer = setTimeout(() => {
          if (g && !g.handled && g.moved < TAP_SLOP) {
            this.actionsPressed.add('potion');
            g.handled = true;
          }
        }, LONGPRESS);
      });

      canvas.addEventListener('pointermove', (event) => {
        if (!g || event.pointerId !== g.id) return;
        g.moved = Math.max(g.moved, Math.hypot(event.clientX - g.sx, event.clientY - g.sy));
      });

      const finish = (event) => {
        if (!g || event.pointerId !== g.id) return;
        clearTimeout(g.longTimer);
        if (!g.handled) {
          const dx = event.clientX - g.sx;
          const dy = event.clientY - g.sy;
          const dist = Math.hypot(dx, dy);
          const dt = performance.now() - g.t;
          if (dist >= FLICK_MIN) {
            this.gestureRollDir = BH.normalize(dx, dy);
            this.actionsPressed.add('roll');
          } else if (dt <= TAP_TIME && dist < TAP_SLOP) {
            this.actionsPressed.add('attack');
          }
        }
        g = null;
      };

      canvas.addEventListener('pointerup', finish);
      canvas.addEventListener('pointercancel', (event) => {
        if (g && event.pointerId === g.id) { clearTimeout(g.longTimer); g = null; }
      });
    }

    bindKeyboard() {
      window.addEventListener('keydown', (event) => {
        const direction = KEY_DIRECTIONS.get(event.key);
        const action = KEY_ACTIONS.get(event.key);
        if (direction || action) event.preventDefault();
        if (direction) this.directions.add(direction);
        if (action) {
          if (!this.actionsDown.has(action)) this.actionsPressed.add(action);
          this.actionsDown.add(action);
        }
      }, { passive: false });

      window.addEventListener('keyup', (event) => {
        const direction = KEY_DIRECTIONS.get(event.key);
        const action = KEY_ACTIONS.get(event.key);
        if (direction) this.directions.delete(direction);
        if (action) this.actionsDown.delete(action);
      });
    }

    bindTouchButtons() {
      const pressAction = (action) => {
        if (!this.actionsDown.has(action)) this.actionsPressed.add(action);
        this.actionsDown.add(action);
      };
      const releaseAction = (action) => this.actionsDown.delete(action);

      document.querySelectorAll('[data-dir]').forEach((button) => {
        const direction = button.dataset.dir;
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          button.setPointerCapture?.(event.pointerId);
          this.directions.add(direction);
        });
        button.addEventListener('pointerup', () => this.directions.delete(direction));
        button.addEventListener('pointercancel', () => this.directions.delete(direction));
        button.addEventListener('pointerleave', () => this.directions.delete(direction));
      });

      document.querySelectorAll('[data-action]').forEach((button) => {
        const action = button.dataset.action;
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          button.setPointerCapture?.(event.pointerId);
          pressAction(action);
        });
        button.addEventListener('pointerup', () => releaseAction(action));
        button.addEventListener('pointercancel', () => releaseAction(action));
        button.addEventListener('lostpointercapture', () => releaseAction(action));
      });
    }

    bindVirtualStick() {
      const stick = document.getElementById('virtualStick');
      const knob = document.getElementById('stickKnob');
      if (!stick || !knob) return;

      const updateStick = (event) => {
        const rect = stick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDistance = Math.max(32, Math.min(rect.width, rect.height) * 0.32);
        const rawX = event.clientX - centerX;
        const rawY = event.clientY - centerY;
        const distance = Math.hypot(rawX, rawY);
        const scale = distance > maxDistance ? maxDistance / distance : 1;
        const x = rawX * scale;
        const y = rawY * scale;
        const deadZone = 0.16;
        let axisX = x / maxDistance;
        let axisY = y / maxDistance;
        if (Math.hypot(axisX, axisY) < deadZone) {
          axisX = 0;
          axisY = 0;
        }
        this.stickVector = { x: axisX, y: axisY };
        knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        stick.classList.add('is-active');
      };

      const resetStick = () => {
        this.stickPointerId = null;
        this.stickVector = { x: 0, y: 0 };
        knob.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('is-active');
      };

      stick.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (this.stickPointerId !== null) return;
        this.stickPointerId = event.pointerId;
        stick.setPointerCapture?.(event.pointerId);
        updateStick(event);
      }, { passive: false });

      stick.addEventListener('pointermove', (event) => {
        if (event.pointerId !== this.stickPointerId) return;
        event.preventDefault();
        updateStick(event);
      }, { passive: false });

      stick.addEventListener('pointerup', (event) => {
        if (event.pointerId === this.stickPointerId) resetStick();
      });
      stick.addEventListener('pointercancel', (event) => {
        if (event.pointerId === this.stickPointerId) resetStick();
      });
      stick.addEventListener('lostpointercapture', resetStick);
    }

    axis() {
      let x = this.stickVector.x;
      let y = this.stickVector.y;
      if (this.directions.has('left')) x -= 1;
      if (this.directions.has('right')) x += 1;
      if (this.directions.has('up')) y -= 1;
      if (this.directions.has('down')) y += 1;
      return BH.normalize(x, y);
    }

    consume(action) {
      if (!this.actionsPressed.has(action)) return false;
      this.actionsPressed.delete(action);
      return true;
    }

    clear() {
      this.actionsDown.clear();
      this.actionsPressed.clear();
      this.directions.clear();
      this.stickVector = { x: 0, y: 0 };
      this.stickPointerId = null;
      this.gestureRollDir = null;
      document.getElementById('stickKnob')?.style.setProperty('transform', 'translate(-50%, -50%)');
      document.getElementById('virtualStick')?.classList.remove('is-active');
    }

    endFrame() {
      this.actionsPressed.clear();
    }
  };
})();
