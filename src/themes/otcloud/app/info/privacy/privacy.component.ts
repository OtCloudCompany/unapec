import {
  CommonModule,
  NgIf,
} from '@angular/common';
import {
  Component,
  OnDestroy,
} from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { PrivacyComponent as BaseComponent } from '../../../../../app/info/privacy/privacy.component';

@Component({
  selector: 'ds-themed-privacy-content-en',
  standalone: true,
  templateUrl: './privacy-content/privacy-content.component.en.html',
  imports: [
    RouterModule,
    TranslateModule,
  ],
})
export class PrivacyContentEnComponent {
}

@Component({
  selector: 'ds-themed-privacy-content-es',
  standalone: true,
  templateUrl: './privacy-content/privacy-content.component.es.html',
  imports: [
    RouterModule,
    TranslateModule,
  ],
})
export class PrivacyContentEsComponent {
}

@Component({
  selector: 'ds-themed-privacy',
  styleUrls: ['../../../../../app/info/privacy/privacy.component.scss'],
  template: `
    <ng-container *ngIf="isSpanish; else englishTemplate">
      <ds-themed-privacy-content-es></ds-themed-privacy-content-es>
    </ng-container>

    <ng-template #englishTemplate>
      <ds-themed-privacy-content-en></ds-themed-privacy-content-en>
    </ng-template>
  `,
  imports: [
    CommonModule,
    NgIf,
    PrivacyContentEnComponent,
    PrivacyContentEsComponent,
  ],
})
export class PrivacyComponent extends BaseComponent implements OnDestroy {
  isSpanish = false;
  private langSubscription: Subscription;

  constructor(private translate: TranslateService) {
    super();
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
