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
  Observable,
  of,
} from 'rxjs';
import {
  catchError,
  map,
} from 'rxjs/operators';

import { getDSORoute } from '../../../app-routing-paths';
import { AuthorizationDataService } from '../../../core/data/feature-authorization/authorization-data.service';
import { FeatureID } from '../../../core/data/feature-authorization/feature-id';
import { SiteDataService } from '../../../core/data/site-data.service';
import { Collection } from '../../../core/shared/collection.model';
import { Community } from '../../../core/shared/community.model';
import { DSpaceObject } from '../../../core/shared/dspace-object.model';
import { Item } from '../../../core/shared/item.model';
import { Site } from '../../../core/shared/site.model';
import { hasValue } from '../../empty.util';
import { LinkMenuItemModel } from '../menu-item/models/link.model';
import { TextMenuItemModel } from '../menu-item/models/text.model';
import { MenuItemType } from '../menu-item-type.model';
import { PartialMenuSection } from '../menu-provider.model';
import { DSpaceObjectPageMenuProvider } from './helper-providers/dso.menu';

/**
 * Builds the "Statistics" dropdown in the public navbar.
 *
 * Replaces the stock single statistics link. The reports are scoped to whatever the user is looking
 * at — a community (including all of its sub-communities, since usage events carry every ancestor),
 * a collection, or the repository as a whole when the user is not on a container page. That mirrors
 * how a reader expects statistics to behave: the same set of questions, asked of wherever they
 * happen to be.
 *
 * Item pages get only the stock detailed report; "top authors within one item" is meaningless.
 */
@Injectable()
export class UsageStatisticsMenuProvider extends DSpaceObjectPageMenuProvider {

  constructor(
    protected authorizationService: AuthorizationDataService,
    protected siteDataService: SiteDataService,
  ) {
    super();
  }

  /**
   * Always applicable: with no DSpace object in the route the dropdown falls back to
   * repository-wide reports.
   */
  protected isApplicable(dso: DSpaceObject): boolean {
    return true;
  }

  public getSectionsForContext(dso: DSpaceObject): Observable<PartialMenuSection[]> {
    return combineLatest([
      this.authorizationService.isAuthorized(FeatureID.CanViewUsageStatistics, dso?._links.self.href),
      this.resolveScopeId(dso),
    ]).pipe(
      map(([authorized, scopeId]) => this.buildSections(dso, scopeId, authorized)),
    );
  }

  /**
   * Work out which object the reports should be scoped to: the object in the route when it is a
   * container, otherwise the Site.
   *
   * @return the uuid to scope by, or null when it could not be determined
   */
  private resolveScopeId(dso: DSpaceObject): Observable<string | null> {
    if (this.isContainer(dso)) {
      return of(dso.uuid);
    }
    // No container in the route (home page, search, an item, ...) so report on the whole
    // repository. The Site uuid is what the statistics endpoints expect for that.
    return this.siteDataService.find().pipe(
      map((site: Site) => hasValue(site) ? site.uuid : null),
      catchError(() => of(null)),
    );
  }

  private isContainer(dso: DSpaceObject): boolean {
    return hasValue(dso) && (dso instanceof Community || dso instanceof Collection);
  }

  /**
   * Assemble the parent entry and its children.
   *
   * The parentID wiring is what turns a flat list of sections into a dropdown; it mirrors what
   * AbstractExpandableMenuProvider does, reproduced here because this provider also needs the
   * route context that helper does not supply.
   */
  private buildSections(dso: DSpaceObject, scopeId: string | null, authorized: boolean): PartialMenuSection[] {
    const parentID = this.getAutomatedSectionId(0);
    const children: PartialMenuSection[] = [];

    // Item pages keep only the stock detailed report.
    const scoped = hasValue(scopeId) && !(dso instanceof Item);

    if (scoped) {
      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.overview',
          link: `/usage-dashboard/${scopeId}`,
        } as LinkMenuItemModel,
      });

      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.top-items',
          link: `/top-items-stats/${scopeId}`,
        } as LinkMenuItemModel,
      });

      // Unlike usage-by-metadata below, search-term counts are exact - drawn straight from search
      // events rather than aggregated from a capped sample of items - so there is no accuracy
      // caveat that would argue for withholding this one from the menu.
      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.top-searches',
          link: `/top-searches/${scopeId}`,
        } as LinkMenuItemModel,
      });

      // Usage-by-metadata quick links. The usage core holds no item metadata, so the server
      // aggregates a capped set of the most-viewed items and the totals are a lower bound rather
      // than repository-wide figures - see MetadataUsageService's javadoc. The report itself
      // surfaces that caveat (the "truncated" banner); it is not repeated per menu entry here.
      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.top-authors',
          link: `/metadata-usage/${scopeId}`,
          queryParams: { field: 'dc.contributor.author' },
        } as LinkMenuItemModel,
      });

      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.top-publishers',
          link: `/metadata-usage/${scopeId}`,
          queryParams: { field: 'dc.publisher' },
        } as LinkMenuItemModel,
      });

      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.top-subjects',
          link: `/metadata-usage/${scopeId}`,
          queryParams: { field: 'dc.subject' },
        } as LinkMenuItemModel,
      });

      // Countries aren't aggregated from metadata - they come straight from the usage dashboard's
      // own facet on countryCode - so this deep-links into that report's countries card rather
      // than duplicating the query.
      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.top-countries',
          link: `/usage-dashboard/${scopeId}`,
          fragment: 'usage-dashboard-top-countries',
        } as LinkMenuItemModel,
      });
    } else {
      // Item pages have none of the above - "top authors within one item" is meaningless - so they
      // fall back to the stock DSpace statistics page, which covers views over time and downloads
      // for that single item.
      children.push({
        visible: authorized,
        model: {
          type: MenuItemType.LINK,
          text: 'menu.section.statistics.detailed',
          link: this.detailedStatisticsLink(dso),
        } as LinkMenuItemModel,
      });
    }

    const sections: PartialMenuSection[] = children.map((child, index) => ({
      ...child,
      id: `${parentID}_${index}`,
      parentID,
      alwaysRenderExpandable: false,
    }));

    sections.push({
      id: parentID,
      visible: authorized,
      model: {
        type: MenuItemType.TEXT,
        text: 'menu.section.statistics',
      } as TextMenuItemModel,
      icon: 'chart-line',
      alwaysRenderExpandable: true,
      dropdownAlignEnd: true,
    });

    return sections;
  }

  /**
   * Link to the stock statistics page for the object in the route, or the repository-wide one.
   */
  private detailedStatisticsLink(dso: DSpaceObject): string {
    if (hasValue(dso)) {
      const dsoRoute = getDSORoute(dso);
      if (hasValue(dsoRoute)) {
        return `statistics${dsoRoute}`;
      }
    }
    return 'statistics';
  }
}
