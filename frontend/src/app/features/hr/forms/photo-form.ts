import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ConfirmButton } from '../../../shared/ui/confirm-button';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { initialsOf } from '../../../shared/utils/initials';
import { HrApi } from '../hr-api';

// ID card portraits are 4:5. A small JPEG is plenty for every place a face shows.
const WIDTH = 480;
const HEIGHT = 600;
const QUALITY = 0.85;
const MAX_FILE_BYTES = 10_485_760; // 10 MB
const HALVES = 2;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))), 'image/jpeg', QUALITY));

@Component({
  selector: 'app-photo-form',
  imports: [ConfirmButton, ModalHeading, NgOptimizedImage],
  template: `
    <app-modal-heading eyebrow="ID CARD" [heading]="'Photo for ' + firstName()" intro="A clear, front facing photo on a plain background. It's cropped to the card and location data in the file is removed." />
    <div class="photo-picker">
      <canvas #preview [hidden]="!isPicked()" role="img" aria-label="Preview of the new photo" data-testid="photo-preview"></canvas>
      @if (!isPicked()) {
        @if (photoUrl(); as current) {
          <img [ngSrc]="current" width="192" height="240" alt="Their current photo" />
        } @else {
          <div class="portrait-initials" aria-hidden="true">{{ initials() }}</div>
        }
      }
      <label class="secondary-button">
        {{ isPicked() || photoUrl() ? 'Choose another photo' : 'Choose a photo' }}
        <input #file type="file" class="sr-only" [accept]="accepted" (change)="pick(file.files?.[0])" data-testid="photo-file" />
      </label>
    </div>
    @if (problem(); as message) {
      <p role="alert">{{ message }}</p>
    }
    <div class="modal-actions">
      @if (photoUrl() && !isPicked()) {
        <app-confirm-button label="Remove photo" question="Go back to initials?" yes="Yes, remove it" testId="remove-photo" (confirmed)="remove()" />
      }
      <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
      <button type="button" class="primary-button" [disabled]="!isPicked() || isSaving()" (click)="save()" data-testid="photo-submit">Save photo</button>
    </div>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly photoUrl = input<string>();
  readonly saved = output();
  readonly cancelled = output();

  private readonly preview = viewChild.required<ElementRef<HTMLCanvasElement>>('preview');
  protected readonly accepted = ACCEPTED.join(',');
  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly isPicked = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly problem = signal<string | undefined>(undefined);

  protected async pick(file: File | undefined) {
    this.problem.set(undefined);
    if (!file) {
      return;
    }
    if (!ACCEPTED.includes(file.type) || file.size > MAX_FILE_BYTES) {
      this.problem.set('Pick a JPG, PNG or WebP photo under 10 MB.');
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = this.preview().nativeElement;
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('No canvas to draw on');
      }
      // Cover the frame and centre, the way object-fit: cover would.
      const scale = Math.max(WIDTH / bitmap.width, HEIGHT / bitmap.height);
      const drawnWidth = bitmap.width * scale;
      const drawnHeight = bitmap.height * scale;
      context.drawImage(bitmap, (WIDTH - drawnWidth) / HALVES, (HEIGHT - drawnHeight) / HALVES, drawnWidth, drawnHeight);
      bitmap.close();
      this.isPicked.set(true);
    } catch (error) {
      console.error('Reading a photo failed', error);
      this.problem.set("That file isn't a photo we can read. Try another one.");
    }
  }

  protected async save() {
    this.isSaving.set(true);
    this.problem.set(undefined);
    try {
      await this.api.savePhoto(this.employeeId(), await toJpeg(this.preview().nativeElement));
      this.saved.emit();
    } catch (error) {
      console.error('Saving a photo failed', error);
      this.problem.set("That didn't save. Try again in a moment.");
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async remove() {
    this.problem.set(undefined);
    try {
      await this.api.removePhoto(this.employeeId());
      this.saved.emit();
    } catch (error) {
      console.error('Removing a photo failed', error);
      this.problem.set("That didn't save. Try again in a moment.");
    }
  }
}
