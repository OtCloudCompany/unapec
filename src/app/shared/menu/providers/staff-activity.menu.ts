/**
 * The contents of this file are subject to the license and copyright
 * detailed in the LICENSE and NOTICE files at the root of the source
 * tree and available online at
 *
 * http://www.dspace.org/license/
 */

import { Injectable } from '@angular/core';
import {
  combineLatest,
  map,
  Observable,
} from 'rxjs';
import { ConfigurationDataService } from 'src/app/core/data/configuration-data.service';
import { AuthorizationDataService } from 'src/app/core/data/feature-authorization/authorization-data.service';
import { FeatureID } from 'src/app/core/data/feature-authorization/feature-id';
import { RemoteData } from 'src/app/core/data/remote-data';
import { ConfigurationProperty } from 'src/app/core/shared/configuration-property.model';
import { getFirstCompletedRemoteData } from 'src/app/core/shared/operators';

import { MenuItemType } from '../menu-item-type.model';
import {
  AbstractMenuProvider,
  PartialMenuSection,
} from '../menu-provider.model';

/**
 * Adds the staff activity report to the admin sidebar.
 *
 * Hidden unless the current user is a site administrator and auditing is switched on server-side:
 * the report reads the audit trail, so with auditing off it would only ever show an empty table.
 */
@Injectable()
export class StaffActivityMenuProvider extends AbstractMenuProvider {
  constructor(
    protected authorizationService: AuthorizationDataService,
    protected configurationDataService: ConfigurationDataService,
  ) {
    super();
  }

  public getSections(): Observable<PartialMenuSection[]> {
    return combineLatest([
      this.authorizationService.isAuthorized(FeatureID.AdministratorOf),
      this.configurationDataService.findByPropertyName('audit.enabled').pipe(
        getFirstCompletedRemoteData(),
        map((response: RemoteData<ConfigurationProperty>) => {
          return response.hasSucceeded ? (response.payload.values.length > 0 && response.payload.values[0] === 'true') : false;
        }),
      ),
    ]).pipe(
      map(([isSiteAdmin, isAuditEnabled]) => {
        return [
          {
            visible: isSiteAdmin && isAuditEnabled,
            model: {
              type: MenuItemType.LINK,
              text: 'menu.section.staff-activity',
              link: '/staff-activity',
            },
            icon: 'user-clock',
          },
        ] as PartialMenuSection[];
      }),
    );
  }
}
