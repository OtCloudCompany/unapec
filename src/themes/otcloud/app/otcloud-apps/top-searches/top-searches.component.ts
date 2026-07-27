import { CommonModule } from '@angular/common';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  NgbDateStruct,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DSONameService } from 'src/app/core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from 'src/app/core/data/dspace-object-data.service';
import { getFirstSucceededRemoteData } from 'src/app/core/shared/operators';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

import { ngbDateToIso } from '../ngb-date.util';

export interface SearchTermRow {
  id: string;
  query: string;
  count: number;
}

export interface SearchTermResponse {
  content: SearchTermRow[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Which search terms readers actually type, scoped to the site as a whole, a community or a
 * collection.
 *
 * Backed by /api/otcloud-stats/top-searches, which counts every search event recorded against the
 * usage statistics core - both ones that ended without a clicked result and ones that led to an
 * item - grouped by the exact query string.
 */
@Component({
  selector: 'ds-top-searches',
  imports: [CommonModule, NgbDatepickerModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './top-searches.component.html',
  styleUrl: './top-searches.component.scss',
})
export class TopSearchesComponent implements OnInit, OnDestroy {

  @Input() uuid?: string;
  @Input() object?: any;

  rows: SearchTermRow[] = [];
  resolvedUuid: string | null = null;
  resolvedObjectName = '';

  isLoading = false;
  errorMessage: string | null = null;
  noData = false;

  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 1;

  filterForm = new FormGroup({
    startDate: new FormControl<NgbDateStruct | null>(null),
    endDate: new FormControl<NgbDateStruct | null>(null),
    size: new FormControl(20),
  });

  private sub?: Subscription;
  private routeSub?: Subscription;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private dsoService: DSpaceObjectDataService,
    private dsoNameService: DSONameService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) { }

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      this.resolvedUuid = params['uuid'] || this.uuid || this.object?.uuid || this.object?.id;
      if (!this.resolvedUuid) {
        this.errorMessage = 'No UUID provided for the top searches report.';
        this.cdr.detectChanges();
        return;
      }
      this.resolveName();
      this.fetch(true);
    });
  }

  private resolveName(): void {
    if (this.object) {
      this.resolvedObjectName = this.dsoNameService.getName(this.object);
      return;
    }
    this.dsoService.findById(this.resolvedUuid).pipe(
      getFirstSucceededRemoteData(),
    ).subscribe((rd) => {
      if (rd.hasSucceeded && rd.payload) {
        this.resolvedObjectName = this.dsoNameService.getName(rd.payload);
        this.cdr.detectChanges();
      }
    });
  }

  fetch(resetPage = false): void {
    if (!this.resolvedUuid) {
      return;
    }
    if (resetPage) {
      this.currentPage = 0;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.cdr.detectChanges();

    this.pageSize = this.filterForm.value.size || 20;

    let params = new HttpParams()
      .set('uuid', this.resolvedUuid)
      .set('size', this.pageSize.toString())
      .set('page', this.currentPage.toString());

    const start = ngbDateToIso(this.filterForm.value.startDate);
    const end = ngbDateToIso(this.filterForm.value.endDate);
    if (start && end) {
      params = params.set('startDate', `${start}T00:00:00Z`).set('endDate', `${end}T23:59:59Z`);
    }

    this.sub?.unsubscribe();
    this.sub = this.http.get<SearchTermResponse>(this.endpoint(), { params }).subscribe({
      next: (response) => {
        this.rows = response.content || [];
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 1;
        this.noData = this.rows.length === 0 && this.currentPage === 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching top searches:', err);
        this.errorMessage = 'Failed to load the top searches report.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onSubmit(): void {
    this.fetch(true);
  }

  onPageChange(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.fetch(false);
    }
  }

  onPageSizeChange(event: Event): void {
    const size = parseInt((event.target as HTMLSelectElement).value, 10);
    this.filterForm.patchValue({ size });
    this.fetch(true);
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  /**
   * Export the current page's rows. The server has no CSV endpoint for this report, so the file is
   * assembled here from what is on screen.
   */
  downloadCSV(): void {
    const headers = ['Query', 'Count'];
    const rows = this.rows.map((row) => [
      `"${(row.query || '').replace(/"/g, '""')}"`,
      row.count,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Top_Searches_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private endpoint(): string {
    const baseUrl = this.appConfig.rest.baseUrl;
    const separator = baseUrl.endsWith('/') ? '' : '/';
    return `${baseUrl}${separator}api/otcloud-stats/top-searches`;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }
}
