/**
 * Pointer-lock first-person flight controls with smoothed keyboard acceleration.
 * Input collection is isolated from camera simulation and has no collision responsibility.
 */

import { Euler, MathUtils, PerspectiveCamera, Vector3 } from 'three';

const MIN_SPEED = 28;
const MAX_SPEED = 220;
const VERTICAL_SPEED_FACTOR = 0.72;
const MOUSE_SENSITIVITY = 0.0019;

export class FlightControls {
  public speed = 82;
  private readonly pressed = new Set<string>();
  private readonly velocity = new Vector3();
  private readonly desiredVelocity = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly rotation = new Euler(0, 0, 0, 'YXZ');

  public constructor(private readonly camera: PerspectiveCamera, private readonly canvas: HTMLCanvasElement) {
    this.rotation.setFromQuaternion(camera.quaternion);
    canvas.addEventListener('click', this.lockPointer);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearKeys);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  public update(deltaSeconds: number): void {
    this.readMovementIntent();
    const damping = this.desiredVelocity.lengthSq() > 0 ? 6.8 : 4.5;
    this.velocity.x = MathUtils.damp(this.velocity.x, this.desiredVelocity.x, damping, deltaSeconds);
    this.velocity.y = MathUtils.damp(this.velocity.y, this.desiredVelocity.y, damping, deltaSeconds);
    this.velocity.z = MathUtils.damp(this.velocity.z, this.desiredVelocity.z, damping, deltaSeconds);
    this.camera.position.addScaledVector(this.velocity, deltaSeconds);
  }

  public dispose(): void {
    this.canvas.removeEventListener('click', this.lockPointer);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearKeys);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  private readMovementIntent(): void {
    this.camera.getWorldDirection(this.forward).normalize();
    this.right.crossVectors(this.forward, this.camera.up).normalize();
    this.desiredVelocity.set(0, 0, 0);
    this.addAxis('KeyW', 'KeyS', this.forward, this.speed);
    this.addAxis('KeyD', 'KeyA', this.right, this.speed);
    this.addVerticalAxis();
    if (this.desiredVelocity.length() > this.speed) this.desiredVelocity.setLength(this.speed);
  }

  private addAxis(positive: string, negative: string, axis: Vector3, magnitude: number): void {
    const direction = Number(this.pressed.has(positive)) - Number(this.pressed.has(negative));
    if (direction !== 0) this.desiredVelocity.addScaledVector(axis, magnitude * direction);
  }

  private addVerticalAxis(): void {
    const direction = Number(this.pressed.has('Space')) - Number(this.pressed.has('ShiftLeft') || this.pressed.has('ShiftRight'));
    this.desiredVelocity.y += direction * this.speed * VERTICAL_SPEED_FACTOR;
  }

  private readonly lockPointer = (): void => {
    if (document.pointerLockElement !== this.canvas) void this.canvas.requestPointerLock();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly clearKeys = (): void => {
    this.pressed.clear();
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.rotation.y -= event.movementX * MOUSE_SENSITIVITY;
    this.rotation.x -= event.movementY * MOUSE_SENSITIVITY;
    this.rotation.x = MathUtils.clamp(this.rotation.x, -Math.PI * 0.48, Math.PI * 0.48);
    this.camera.quaternion.setFromEuler(this.rotation);
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    event.preventDefault();
    this.speed = MathUtils.clamp(this.speed * Math.exp(-event.deltaY * 0.001), MIN_SPEED, MAX_SPEED);
  };

  private readonly handlePointerLockChange = (): void => {
    document.body.classList.toggle('is-flying', document.pointerLockElement === this.canvas);
    if (document.pointerLockElement !== this.canvas) this.clearKeys();
  };
}
