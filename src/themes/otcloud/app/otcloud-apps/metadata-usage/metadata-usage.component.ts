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
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DSONameService } from 'src/app/core/breadcrumbs/dso-name.service';
import { DSpaceObjectDataService } from 'src/app/core/data/dspace-object-data.service';
import { getFirstSucceededRemoteData } from 'src/app/core/shared/operators';
import {
  APP_CONFIG,
  AppConfig,
} from 'src/config/app-config.interface';

export interface MetadataUsageRow {
  id: string;
  value: string;
  views: number;
  downloads: number;
  items: number;
  truncated: boolean;
  itemsConsidered: number;
}

export interface MetadataUsageResponse {
  content: MetadataUsageRow[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

/**
 * Usage aggregated by the values of a metadata field: which authors, subjects, types or departments
 * attract the most traffic.
 *
 * Backed by /api/otcloud-stats/metadata-usage. The usage statistics core stores no item metadata, so
 * the server produces this by grouping the most-viewed items in scope. That set of items is capped,
 * and when the cap is reached the response is flagged truncated - which this component surfaces
 * rather than hides, because the counts are then a lower bound over the most-viewed items rather
 * than repository-wide totals.
 */
@Component({
  selector: 'ds-metadata-usage',
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './metadata-usage.component.html',
  styleUrl: './metadata-usage.component.scss',
})
export class MetadataUsageComponent implements OnInit, OnDestroy {

  @Input() uuid?: string;
  @Input() object?: any;

  /**
   * Fields offered in the picker. Any schema.element[.qualifier] the repository uses is valid; these
   * are simply the ones worth reaching for first.
   */
  readonly fieldOptions = [
    { value: 'dc.contributor.author', labelKey: 'otcloud.metadata-usage.field.author' },
    { value: 'dc.subject', labelKey: 'otcloud.metadata-usage.field.subject' },
    { value: 'dc.type', labelKey: 'otcloud.metadata-usage.field.type' },
    { value: 'dc.publisher', labelKey: 'otcloud.metadata-usage.field.publisher' },
    { value: 'dc.language.iso', labelKey: 'otcloud.metadata-usage.field.language' },
  ];

  rows: MetadataUsageRow[] = [];
  resolvedUuid: string | null = null;
  resolvedObjectName = '';

  isLoading = false;
  errorMessage: string | null = null;
  noData = false;

  truncated = false;
  itemsConsidered = 0;

  currentPage = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 1;

  filterForm = new FormGroup({
    field: new FormControl('dc.contributor.author'),
    startDate: new FormControl(''),
    endDate: new FormControl(''),
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
        this.errorMessage = 'No UUID provided for the metadata usage report.';
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
      .set('field', this.filterForm.value.field || 'dc.contributor.author')
      .set('size', this.pageSize.toString())
      .set('page', this.currentPage.toString());

    const start = this.filterForm.value.startDate;
    const end = this.filterForm.value.endDate;
    if (start && end) {
      params = params.set('startDate', `${start}T00:00:00Z`).set('endDate', `${end}T23:59:59Z`);
    }

    this.sub?.unsubscribe();
    this.sub = this.http.get<MetadataUsageResponse>(this.endpoint(), { params }).subscribe({
      next: (response) => {
        this.rows = response.content || [];
        this.totalElements = response.totalElements || 0;
        this.totalPages = response.totalPages || 1;
        this.noData = this.rows.length === 0 && this.currentPage === 0;
        // Every row carries the same aggregation-wide flags; read them off the first.
        this.truncated = this.rows.length > 0 && this.rows[0].truncated;
        this.itemsConsidered = this.rows.length > 0 ? this.rows[0].itemsConsidered : 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching metadata usage:', err);
        this.errorMessage = 'Failed to load the metadata usage report.';
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
    const headers = ['Value', 'Views', 'Downloads', 'Items'];
    const rows = this.rows.map((row) => [
      `"${(row.value || '').replace(/"/g, '""')}"`,
      row.views,
      row.downloads,
      row.items,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const field = (this.filterForm.value.field || 'metadata').replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Metadata_Usage_${field}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private endpoint(): string {
    const baseUrl = this.appConfig.rest.baseUrl;
    const separator = baseUrl.endsWith('/') ? '' : '/';
    return `${baseUrl}${separator}api/otcloud-stats/metadata-usage`;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }
}
