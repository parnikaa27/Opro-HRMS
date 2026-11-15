import { TestBed } from '@angular/core/testing';
import { NOW, respond, setupHttp, texts } from '../../../testing/fixtures';
import { DeviceNote } from './device-note';

const DEVICES = [
  { id: 'OPR-MLE-01', name: 'Front desk', location: 'Malé office', isOnline: true, lastSyncAt: '2026-11-12T05:27:00Z' },
  { id: 'OPR-HMH-01', name: 'Site gate', location: 'Hulhumalé site', isOnline: false, lastSyncAt: '2026-11-12T05:29:00Z' },
];

describe('DeviceNote', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  const render = async (location?: string) => {
    const http = setupHttp();
    const fixture = TestBed.createComponent(DeviceNote);
    fixture.componentRef.setInput('location', location);
    await respond(http, { '/api/devices': DEVICES });
    return texts(fixture.nativeElement, 'device-note');
  };

  it('shows only the device for one office', async () => {
    expect(await render('Malé office')).toEqual(['Biometric device connected Front desk · Device OPR-MLE-01 · Last sync 3 minutes ago Online']);
  });

  it('shows every device, including offline ones, when no office is given', async () => {
    expect(await render()).toEqual([
      'Biometric device connected Front desk · Device OPR-MLE-01 · Last sync 3 minutes ago Online',
      'Biometric device offline Site gate · Device OPR-HMH-01 · Last sync 1 minute ago Offline',
    ]);
  });
});
