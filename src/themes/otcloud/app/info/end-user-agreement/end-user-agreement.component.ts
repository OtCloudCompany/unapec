import {
  CommonModule,
  NgIf,
} from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  Component,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
} from '@angular/router';
import { Store } from '@ngrx/store';
import {
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { AppState } from '../../../../../app/app.reducer';
import { AuthService } from '../../../../../app/core/auth/auth.service';
import { EndUserAgreementService } from '../../../../../app/core/end-user-agreement/end-user-agreement.service';
import { EndUserAgreementComponent as BaseComponent } from '../../../../../app/info/end-user-agreement/end-user-agreement.component';
import { NotificationsService } from '../../../../../app/shared/notifications/notifications.service';
import { BtnDisabledDirective } from '../../../../../app/shared/btn-disabled.directive';

@Component({
  selector: 'ds-themed-end-user-agreement-en',
  standalone: true,
  templateUrl: './end-user-agreement.component.en.html',
  imports: [
    BtnDisabledDirective,
    FormsModule,
    TranslateModule,
    RouterModule,
  ],
})
export class EndUserAgreementEnComponent extends BaseComponent {
  constructor(
    protected endUserAgreementService: EndUserAgreementService,
    protected notificationsService: NotificationsService,
    protected translate: TranslateService,
    protected authService: AuthService,
    protected store: Store<AppState>,
    protected router: Router,
    protected route: ActivatedRoute,
  ) {
    super(
      endUserAgreementService,
      notificationsService,
      translate,
      authService,
      store,
      router,
      route,
    );
  }
}

@Component({
  selector: 'ds-themed-end-user-agreement-es',
  standalone: true,
  templateUrl: './end-user-agreement.component.es.html',
  imports: [
    BtnDisabledDirective,
    FormsModule,
    TranslateModule,
    RouterModule,
  ],
})
export class EndUserAgreementEsComponent extends BaseComponent {
  constructor(
    protected endUserAgreementService: EndUserAgreementService,
    protected notificationsService: NotificationsService,
    protected translate: TranslateService,
    protected authService: AuthService,
    protected store: Store<AppState>,
    protected router: Router,
    protected route: ActivatedRoute,
  ) {
    super(
      endUserAgreementService,
      notificationsService,
      translate,
      authService,
      store,
      router,
      route,
    );
  }
}

@Component({
  selector: 'ds-themed-end-user-agreement',
  styleUrls: ['../../../../../app/info/end-user-agreement/end-user-agreement.component.scss'],
  template: `
    <ng-container *ngIf="isSpanish; else englishTemplate">
      <ds-themed-end-user-agreement-es></ds-themed-end-user-agreement-es>
    </ng-container>

    <ng-template #englishTemplate>
      <ds-themed-end-user-agreement-en></ds-themed-end-user-agreement-en>
    </ng-template>
  `,
  imports: [
    CommonModule,
    NgIf,
    EndUserAgreementEnComponent,
    EndUserAgreementEsComponent,
  ],
})
export class EndUserAgreementComponent implements OnDestroy {
  isSpanish = false;
  private langSubscription: Subscription;

  constructor(private translate: TranslateService) {
    this.updateSelectedLanguage();
    this.langSubscription = this.translate.onLangChange.subscribe(() => this.updateSelectedLanguage());
  }

  ngOnDestroy(): void {
    this.langSubscription.unsubscribe();
  }

  private updateSelectedLanguage(): void {
    const currentLang = this.translate.currentLang || this.translate.defaultLang || 'en';
    this.isSpanish = currentLang.startsWith('es');
  }
}
