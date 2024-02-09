import {Component} from '@angular/core';
import {ViewSwitchService} from '../../../shared/viewSwitchService';
import {UnitConversion} from '../../../shared/UnitConversion';
import {ProfileComparatorService} from '../../../shared/profileComparatorService';
import {DiveResults} from '../../../shared/diveresults';
import {formatNumber} from '@angular/common';
import {faArrowDown, faArrowUp, IconDefinition} from '@fortawesome/free-solid-svg-icons';

@Component({
    selector: 'app-diff-diveinfo-results',
    templateUrl: './diff-diveinfo-results.component.html',
    styleUrls: ['./diff-diveinfo-results.component.scss']
})
export class DiveInfoResultsDifferenceComponent {
    private arrowUp: IconDefinition = faArrowUp;
    private arrowDown: IconDefinition = faArrowDown;
    private rowColorVectorMap: Map<string, number> = new Map<string, number>([
        ['totalDuration', 1],
        ['timeToSurface', -1],
        ['averageDepth', -1],
        ['emergencyAscentStart', -1],
        ['noDeco', 1],
        ['maxTime', 1],
        ['highestDensity', -1],
        ['otu', -1],
        ['cns', -1]
    ]);

    constructor(
        private viewSwitch: ViewSwitchService,
        public units: UnitConversion,
        private profileComparatorService: ProfileComparatorService) {
    }

    public get profileA(): DiveResults {
        return this.profileComparatorService.profileAResults();
    }

    public get profileB(): DiveResults {
        return this.profileComparatorService.profileBResults();
    }

    public get areResultsCalculated(): boolean {
        return this.profileComparatorService.areResultsCalculated();
    }

    public get areDiveInfosCalculated(): boolean {
        return this.profileComparatorService.areDiveInfosCalculated();
    }

    public get areProfilesCalculated(): boolean {
        return this.profileComparatorService.areProfilesCalculated();
    }

    public get isComplex(): boolean {
        return this.viewSwitch.isComplex;
    }

    public get needsReturn(): boolean {
        // TODO: Add Profile B
        return this.profileA.needsReturn;
    }

    public get totalDurationDifference(): number {
        return this.profileB.totalDuration - this.profileA.totalDuration;
    }

    public get timeToSurfaceDifference(): number {
        return this.profileB.timeToSurface - this.profileA.timeToSurface;
    }

    public get averageDepthDifference(): number {
        return this.averageDepthOfProfile(this.profileB) - this.averageDepthOfProfile(this.profileA);
    }

    public get emergencyAscentStartDifference(): number {
        return this.profileB.emergencyAscentStart - this.profileA.emergencyAscentStart;
    }

    public get noDecoDifference(): number {
        return this.noDecoOfProfile(this.profileB) - this.noDecoOfProfile(this.profileA);
    }

    public get maxTimeDifference(): number {
        return this.profileB.maxTime - this.profileA.maxTime;
    }

    public get highestDensityDifference(): number {
        return this.highestDensityOfProfile(this.profileB) - this.highestDensityOfProfile(this.profileA);
    }

    public get otuDifference(): number {
        return this.profileB.otu - this.profileA.otu;
    }

    public get cnsDifference(): number {
        return this.profileB.cns - this.profileA.cns;
    }
    public get cnsDifferenceText(): string {
        const diff = this.cnsDifference;
        if(diff >= 1000) {
            return '> 1000';
        }

        if(diff <= -1000) {
            return '< -1000';
        }

        return formatNumber(diff, 'en', '1.0-0');
    }

    public showMaxBottomTimeOfProfile(profile: DiveResults): boolean {
        return profile.maxTime > 0;
    }

    public noDecoOfProfile(profile: DiveResults): number {
        return profile.noDecoTime;
    }

    public averageDepthOfProfile(profile: DiveResults): number {
        return this.units.fromMeters(profile.averageDepth);
    }

    public highestDensityOfProfile(profile: DiveResults): number {
        const density = profile.highestDensity.density;
        return this.units.fromGramPerLiter(density);
    }

    public densityTextOfProfile(profile: DiveResults): string {
        const gas = profile.highestDensity.gas.name;
        const depth = this.units.fromMeters(profile.highestDensity.depth);
        return `${gas} at ${depth} ${this.units.length}`;
    }

    public cnsTextOfProfile(profile: DiveResults): string {
        if(profile.cns >= 1000) {
            return '> 1000';
        }

        return formatNumber(profile.cns, 'en', '1.0-0');
    }

    public getArrow(difference: number): IconDefinition {
        return difference > 0 ? this.arrowUp : this.arrowDown;
    }

    public getBgColor(rowKey: string, value: number): string {
        if(!this.rowColorVectorMap.has(rowKey)){
            console.error('Could not find vector for key: ' + rowKey);
        }

        const isPositive = (this.rowColorVectorMap.get(rowKey) ?? 0) * value > 0;

        if (isPositive){
            return 'table-success';
        }

        if (!isPositive){
            return 'table-danger';
        }

        return 'table-active';
    }
}
