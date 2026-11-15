import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Dismiss } from '../../shared/ui/dismiss';
import { Icon } from '../../shared/ui/icon';
import { valueOr } from '../../shared/utils/resource';
import { TeamApi } from '../../features/team/team-api';
import { HrApi } from '../../features/hr/hr-api';
import { PortalView, Session } from '../session';
import { NavItem } from './nav-items';

interface SearchResult {
  label: string;
  path: string;
  kind: 'Page' | 'Person';
}

const MAX_RESULTS = 6;

@Component({
  selector: 'app-portal-search',
  imports: [Icon, RouterLink],
  template: `
    <app-icon name="search" [size]="18" />
    <input
      #box
      aria-label="Search"
      placeholder="Search anything..."
      role="combobox"
      aria-controls="search-results"
      aria-autocomplete="list"
      [attr.aria-expanded]="showsResults()"
      [value]="query()"
      (input)="query.set(box.value); isOpen.set(true)"
      (focus)="isOpen.set(true)"
      (keydown.enter)="openFirst()"
      data-testid="search-input"
    />
    <kbd>⌘ K</kbd>
    @if (showsResults()) {
      <ul id="search-results" class="search-results" role="listbox" data-testid="search-results">
        @for (result of results(); track result.path) {
          <li role="option" aria-selected="false">
            <a [routerLink]="result.path" (click)="close()">
              <span>{{ result.label }}</span>
              <small>{{ result.kind }}</small>
            </a>
          </li>
        } @empty {
          <li class="search-empty">Nothing matches “{{ query() }}”.</li>
        }
      </ul>
    }
  `,
  host: {
    class: 'header-search',
    '(document:keydown.meta.k)': 'focus($event)',
    '(document:keydown.control.k)': 'focus($event)',
  },
  hostDirectives: [Dismiss],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalSearch {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  readonly items = input.required<readonly NavItem[]>();
  readonly view = input<PortalView>('mine');

  protected readonly query = signal('');
  protected readonly isOpen = signal(false);
  private readonly closeOnDismiss = inject(Dismiss).dismissed.subscribe(() => this.isOpen.set(false));
  private readonly needle = computed(() => this.query().trim().toLowerCase());
  // People only load once someone types, so search costs nothing until used. HR and super admins search everyone, HODs their team.
  private readonly teamPeople = inject(TeamApi).members({ isEnabled: () => this.view() === 'team' && this.session.isManager() && this.needle() !== '' });
  private readonly company = inject(TeamApi).members({ isEnabled: () => this.view() === 'company' && this.session.isSuperAdmin() && this.needle() !== '', scope: () => 'company' });
  private readonly everyone = inject(HrApi).employees({ isEnabled: () => this.view() === 'hr' && this.session.isHr() && this.needle() !== '' });

  protected readonly results = computed<SearchResult[]>(() => {
    const needle = this.needle();
    const pages = this.items()
      .filter(({ label }) => label.toLowerCase().includes(needle))
      .map(({ label, path }) => ({ label, path, kind: 'Page' as const }));
    const people = [
      ...valueOr(this.teamPeople, []).map(({ fullName, id }) => ({ fullName, path: `/team/${id}` })),
      ...valueOr(this.everyone, []).map(({ fullName, id }) => ({ fullName, path: `/hr/people/${id}` })),
      ...valueOr(this.company, []).map(({ fullName, id }) => ({ fullName, path: `/company/${id}` })),
    ]
      .filter(({ fullName }) => fullName.toLowerCase().includes(needle))
      .map(({ fullName, path }) => ({ label: fullName, path, kind: 'Person' as const }));
    return [...pages, ...people].slice(0, MAX_RESULTS);
  });
  protected readonly showsResults = computed(() => this.isOpen() && this.needle() !== '');

  protected focus(event: Event) {
    event.preventDefault();
    this.box().nativeElement.focus();
  }

  protected openFirst() {
    const first = this.results()[0];
    if (first) {
      void this.router.navigateByUrl(first.path);
      this.close();
    }
  }

  protected close() {
    this.query.set('');
    this.isOpen.set(false);
  }
}
