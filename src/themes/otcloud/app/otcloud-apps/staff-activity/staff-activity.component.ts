import { CommonModule } from '@angular/common';
import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  NgbDateStruct,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

import { ngbDateToIso } from '../ngb-date.util';

export interface StaffActivityRow {
  id: string;
  name: string;
  email: string;
  itemsCreated: number;
  itemsArchived: number;
  itemsEdited: number;
  itemsDeleted: number;
  bitstreamsAdded: number;
  totalEvents: number;
}

export interface StaffActivityResponse {
  content: StaffActivityRow[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Reports how much repository work each staff member did over a period: items created, archived,
 * edited or deleted, and files added.
 *
 * Backed by /api/otcloud-stats/staff-activity, which aggregates the audit trail. Every count is a
 * number of distinct objects rather than a number of audit records, because the audit core writes
 * one record per changed metadata value.
 */
@Component({
  selector: 'ds-staff-activity',
  imports: [CommonModule, ReactiveFormsModule, TranslateModule, NgbDatepickerModule],
  templateUrl: './staff-activity.component.html',
  styleUrl: './staff-activity.component.scss',
})
export class StaffActivityComponent implements OnInit, OnDestroy {

  rows: StaffActivityRow[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  validationError: string | null = null;

  /**
   * True when the report came back empty, which most often means auditing has not been switched on.
   */
  noData = false;

  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 1;

  /**
   * Repository-wide total of items created in the reporting period, across every staff member -
   * not just the ones on the current page of {@link rows}.
   */
  totalItemsCreated: number | null = null;

  filterForm = new FormGroup({
    startDate: new FormControl<NgbDateStruct | null>(null),
    endDate: new FormControl<NgbDateStruct | null>(null),
    size: new FormControl(20),
  });

  private sub?: Subscription;
  private summarySub?: Subscription;
  private csvSub?: Subscription;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) { }

  ngOnInit(): void {
    this.fetch(true);
  }

  fetch(resetPage = false): void {
    if (resetPage) {
      this.currentPage = 0;
    }

    this.isLoading = true;
    this.errorMessage = null;
    this.validationError = null;
    this.cdr.detectChanges();

    this.pageSize = this.filterForm.value.size || 20;

    let params = new HttpParams()
      .set('size', this.pageSize.toString())
      .set('page', this.currentPage.toString());
    params = this.withDateRange(params);

    if (this.sub) {
      this.sub.unsubscribe();
    }

    this.sub = this.http.get<StaffActivityResponse>(this.endpoint(), { params }).subscribe({
      next: (response) => {
        this.rows = response.content || [];
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 1;
        this.noData = this.rows.length === 0 && this.currentPage === 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching staff activity:', err);
        this.errorMessage = 'Failed to load the staff activity report. Please try again later.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });

    this.fetchSummary();
  }

  /**
   * The repository-wide "items created" total doesn't fit a paged response, so it's fetched
   * separately with the same date filter.
   */
  private fetchSummary(): void {
    const params = this.withDateRange(new HttpParams());

    this.summarySub?.unsubscribe();
    this.summarySub = this.http.get<{ totalItemsCreated: number }>(this.endpoint() + '/summary', { params })
      .subscribe({
        next: (response) => {
          this.totalItemsCreated = response.totalItemsCreated;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error fetching staff activity summary:', err);
          this.totalItemsCreated = null;
          this.cdr.detectChanges();
        },
      });
  }

  onSubmit(): void {
    const start = this.filterForm.value.startDate;
    const end = this.filterForm.value.endDate;
    if ((start && !end) || (!start && end)) {
      this.validationError = 'Both Start Date and End Date are required to apply date filtering.';
      this.cdr.detectChanges();
      return;
    }
    this.fetch(true);
  }

  onReset(): void {
    this.filterForm.patchValue({ startDate: null, endDate: null });
    this.validationError = null;
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
   * Download the report as CSV.
   *
   * Fetched through HttpClient rather than a plain link so that the request carries the
   * authentication headers DSpace's interceptor adds; the endpoint is administrator-only.
   */
  downloadCSV(): void {
    let params = new HttpParams();
    params = this.withDateRange(params);

    if (this.csvSub) {
      this.csvSub.unsubscribe();
    }

    this.csvSub = this.http.get(this.endpoint() + '/csv', { params, responseType: 'blob' }).subscribe({
      next: (blob) => this.triggerDownload(blob),
      error: (err) => {
        console.error('Error downloading staff activity CSV:', err);
        this.errorMessage = 'Failed to download the CSV export.';
        this.cdr.detectChanges();
      },
    });
  }

  private triggerDownload(blob: Blob): void {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Staff_Activity_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private endpoint(): string {
    const baseUrl = this.appConfig.rest.baseUrl;
    const separator = baseUrl.endsWith('/') ? '' : '/';
    return `${baseUrl}${separator}api/otcloud-stats/staff-activity`;
  }

  /**
   * Add the selected reporting period to a parameter set. The period is sent as a whole-day UTC
   * range.
   */
  private withDateRange(params: HttpParams): HttpParams {
    const start = ngbDateToIso(this.filterForm.value.startDate);
    const end = ngbDateToIso(this.filterForm.value.endDate);
    if (!start || !end) {
      return params;
    }
    return params
      .set('startDate', `${start}T00:00:00Z`)
      .set('endDate', `${end}T23:59:59Z`);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.summarySub?.unsubscribe();
    this.csvSub?.unsubscribe();
  }
}
